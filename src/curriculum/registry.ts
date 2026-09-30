import {
  assertEvaluationOutput,
  audioAnalysisFactors,
  meterBiases,
  type DefinedDomain,
  type CurriculumLessonReader,
  type DomainDefinition,
  type FactorDefinition,
  type LessonDefinition,
  type LessonEvaluator,
  type LessonEvaluatorMap,
  type ThreeLessons,
} from "./contracts";
import type { ClaimRecord, ResearchSource } from "./evidence";

export function defineDomain<const Lessons extends ThreeLessons>(
  definition: DomainDefinition<Lessons>,
  evaluators: LessonEvaluatorMap<Lessons>,
): DefinedDomain<Lessons> {
  const domain = { definition, evaluators };
  assertValidDomainModule(domain);
  return domain;
}

export type CurriculumRegistry = CurriculumLessonReader & Readonly<{
  catalog: readonly DomainDefinition[];
  domainById: (domainId: string) => DomainDefinition | undefined;
  lessonById: (domainId: string, lessonId: string) => LessonDefinition | undefined;
  evaluatorFor: (domainId: string, lessonId: string) => LessonEvaluator;
}>;

export type CurriculumRegistryOptions = Readonly<{
  /** When given, every static claim and source reference must resolve through it. */
  evidence?: Readonly<{
    claimById: (id: string) => ClaimRecord | undefined;
    sourceById: (id: string) => ResearchSource | undefined;
  }>;
}>;

export function createCurriculumRegistry(
  domains: readonly DefinedDomain[],
  options: CurriculumRegistryOptions = {},
): CurriculumRegistry {
  if (domains.length === 0) throw new RangeError("Curriculum registry must include at least one domain.");

  const domainsById = new Map<string, DomainDefinition>();
  const lessonsByKey = new Map<string, LessonDefinition>();
  const evaluatorsByKey = new Map<string, LessonEvaluator>();
  const protocolIds = new Set<string>();

  for (const domain of domains) {
    assertValidDomainModule(domain);
    const { definition, evaluators } = domain;
    if (domainsById.has(definition.id)) throw new RangeError(`Duplicate domain ID: ${definition.id}.`);
    domainsById.set(definition.id, definition);

    for (const lesson of definition.lessons) {
      const key = lessonKey(definition.id, lesson.id);
      if (lessonsByKey.has(key)) throw new RangeError(`Duplicate lesson key: ${key}.`);
      if (protocolIds.has(lesson.protocol.id)) throw new RangeError(`Duplicate protocol ID: ${lesson.protocol.id}.`);
      if (options.evidence) assertResolvableEvidence(lesson, options.evidence);
      lessonsByKey.set(key, lesson);
      evaluatorsByKey.set(key, evaluators[lesson.id]);
      protocolIds.add(lesson.protocol.id);
    }
  }

  const catalog = domains.map((domain) => domain.definition);
  const defaultLesson = catalog[0].lessons[0];

  return {
    catalog,
    defaultLesson,
    domainById: (domainId) => domainsById.get(domainId),
    lessonById: (domainId, lessonId) => lessonsByKey.get(lessonKey(domainId, lessonId)),
    evaluatorFor: (domainId, lessonId) => {
      const evaluator = evaluatorsByKey.get(lessonKey(domainId, lessonId));
      if (!evaluator) throw new RangeError(`No evaluator is registered for lesson ${lessonId}.`);
      return (factors) => {
        const evaluation = evaluator(factors);
        assertEvaluationOutput(evaluation);
        return evaluation;
      };
    },
  };
}

function assertValidDomainModule(domain: DefinedDomain): void {
  const { definition, evaluators } = domain;
  if (!definition.id) throw new TypeError("Domain ID must be non-empty.");
  if (definition.lessons.length !== 3) throw new RangeError(`Domain ${definition.id} must define exactly three lessons.`);

  const lessonIds = new Set<string>();
  const lessonNumbers = new Set<number>();
  for (const lesson of definition.lessons) {
    if (!lesson.id) throw new TypeError(`Domain ${definition.id} contains a lesson with an empty ID.`);
    if (lesson.domainId !== definition.id) {
      throw new RangeError(`Lesson ${lesson.id} must belong to domain ${definition.id}.`);
    }
    if (lessonIds.has(lesson.id)) throw new RangeError(`Duplicate lesson key: ${lessonKey(definition.id, lesson.id)}.`);
    if (lessonNumbers.has(lesson.number)) throw new RangeError(`Domain ${definition.id} must number its lessons uniquely.`);
    if (!lesson.protocol.id) throw new TypeError(`Lesson ${lesson.id} must define a protocol ID.`);
    if (!Number.isFinite(lesson.protocol.durationSeconds) || lesson.protocol.durationSeconds <= 0) {
      throw new RangeError(`Lesson ${lesson.id} must define a finite positive protocol duration.`);
    }
    assertValidFactors(lesson);
    assertValidAudioSettings(lesson);
    lessonIds.add(lesson.id);
    lessonNumbers.add(lesson.number);
  }

  const evaluatorIds = Object.keys(evaluators);
  if (evaluatorIds.length !== lessonIds.size || evaluatorIds.some((lessonId) => !lessonIds.has(lessonId))) {
    throw new RangeError(`Evaluators for domain ${definition.id} must match its three lesson IDs exactly.`);
  }
  for (const lessonId of lessonIds) {
    if (typeof evaluators[lessonId] !== "function") {
      throw new TypeError(`Evaluator for lesson ${lessonId} must be a function.`);
    }
  }
}

function assertResolvableEvidence(
  lesson: LessonDefinition,
  evidence: NonNullable<CurriculumRegistryOptions["evidence"]>,
): void {
  for (const claimId of lesson.claimIds) {
    const claim = evidence.claimById(claimId);
    if (!claim) throw new RangeError(`Lesson ${lesson.id} references unknown claim: ${claimId}.`);
    for (const sourceId of claim.sourceIds) {
      if (!evidence.sourceById(sourceId)) throw new RangeError(`Claim ${claimId} references unknown source: ${sourceId}.`);
    }
  }
  for (const sourceId of lesson.sourceIds) {
    if (!evidence.sourceById(sourceId)) throw new RangeError(`Lesson ${lesson.id} references unknown source: ${sourceId}.`);
  }
}

function assertValidAudioSettings(lesson: LessonDefinition): void {
  const audioFactors = audioAnalysisFactors(lesson);
  if (audioFactors.length === 0) return;
  if (!lesson.inputModes.some((mode) => mode === "microphone" || mode === "file")) {
    throw new RangeError(`Lesson ${lesson.id} defines an audio setting but accepts neither microphone nor file input.`);
  }
  const settings = new Set<string>();
  for (const factor of audioFactors) {
    // Widened so that definitions bypassing the factor types are still rejected at runtime.
    const setting: string | undefined = factor.audioSetting;
    const kind: string = factor.kind;
    if (setting === undefined) continue;
    if (settings.has(setting)) throw new RangeError(`Lesson ${lesson.id} assigns audio setting ${setting} to more than one factor.`);
    settings.add(setting);
    if (setting === "onsetSensitivity" && kind !== "number") {
      throw new RangeError(`Audio setting onsetSensitivity on factor ${factor.id} requires a number factor.`);
    }
    if (setting === "meterBias" && (factor.kind !== "select"
      || !factor.options.every((option) => meterBiases.some((bias) => bias === option.value)))) {
      throw new RangeError(`Audio setting meterBias on factor ${factor.id} requires a select factor with only mixed, duple, or triple options.`);
    }
  }
}

function assertValidFactors(lesson: LessonDefinition): void {
  const lessonId = lesson.id;
  const factors: readonly FactorDefinition[] = lesson.factors;
  const factorIds = new Set<string>();
  for (const factor of factors) {
    if (!factor.id) throw new TypeError(`Lesson ${lessonId} contains a factor with an empty ID.`);
    if (factorIds.has(factor.id)) throw new RangeError(`Lesson ${lessonId} contains duplicate factor ID: ${factor.id}.`);
    factorIds.add(factor.id);

    switch (factor.kind) {
      case "number":
        if (![factor.min, factor.max, factor.step, factor.defaultValue].every(Number.isFinite)
          || factor.min > factor.max
          || factor.defaultValue < factor.min
          || factor.defaultValue > factor.max
          || factor.step <= 0) {
          throw new RangeError(`Number factor ${factor.id} must have finite bounds, an in-range default, and a positive step.`);
        }
        break;
      case "select": {
        const optionValues = new Set<string>();
        for (const option of factor.options) {
          if (optionValues.has(option.value)) throw new RangeError(`Select factor ${factor.id} contains duplicate option: ${option.value}.`);
          optionValues.add(option.value);
        }
        if (!optionValues.has(factor.defaultValue)) {
          throw new RangeError(`Select factor ${factor.id} must use one of its options as the default.`);
        }
        break;
      }
      case "toggle":
        break;
    }
  }
}

function lessonKey(domainId: string, lessonId: string): string {
  return `${domainId}\u0000${lessonId}`;
}
