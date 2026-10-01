import { describe, expect, it } from "vitest";
import { isEvaluationOutput, type CurriculumDomainId, type DomainDefinition, type EvaluationOutput, type LessonDefinition } from "./contracts";
import {
  createCurriculumRegistry,
  defineDomain,
} from "./registry";
import type { ClaimRecord, ResearchSource } from "./evidence";

const evaluation: EvaluationOutput = {
  headline: "Synthetic result",
  result: "1",
  observables: [{
    id: "value",
    label: "Value",
    value: 1,
    unit: null,
    aggregation: "instantaneous",
    claimId: "model.deterministic",
  }],
  trace: [{ x: 0, y: 1, series: "Synthetic" }],
  traceAxes: { x: { label: "x", unit: null }, y: { label: "y", unit: null } },
  visualKind: "measurement",
  annotation: "Synthetic test evaluation.",
  provenance: { source: "model", calibration: "uncalibrated", method: "Synthetic test evaluator" },
};

function lesson(domainId: CurriculumDomainId, id: string, number: 1 | 2 | 3, protocolId = `${domainId}.${id}.v1`): LessonDefinition {
  return {
    id,
    domainId,
    number,
    level: number === 1 ? "foundation" : number === 2 ? "model" : "critique",
    title: id,
    shortTitle: id,
    question: "What does this synthetic lesson establish?",
    objective: "Exercise the curriculum registry.",
    equation: "x = 1",
    equationCaption: "Synthetic equation.",
    predictionPrompt: "Predict one.",
    experimentPrompt: "Run one.",
    interpretationPrompt: "Interpret one.",
    transferPrompt: "Transfer one.",
    factors: [],
    claimIds: ["model.deterministic"],
    sourceIds: ["synthetic"],
    protocol: { id: protocolId, deterministic: true, durationSeconds: 1 },
    inputModes: ["synthetic"],
  };
}

function domain(
  id: CurriculumDomainId,
  lessonIds: readonly [string, string, string] = ["one", "two", "three"],
  protocolIds?: readonly [string, string, string],
): DomainDefinition {
  return {
    id,
    number: 1,
    title: id,
    shortTitle: id,
    mark: "*",
    description: "Synthetic domain.",
    lessons: [
      lesson(id, lessonIds[0], 1, protocolIds?.[0]),
      lesson(id, lessonIds[1], 2, protocolIds?.[1]),
      lesson(id, lessonIds[2], 3, protocolIds?.[2]),
    ],
  };
}

function module(id: CurriculumDomainId, lessonIds: readonly [string, string, string] = ["one", "two", "three"]) {
  const definition = domain(id, lessonIds);
  return defineDomain(definition, Object.fromEntries(definition.lessons.map((item) => [item.id, () => evaluation])) as {
    [LessonId in (typeof definition.lessons)[number]["id"]]: () => EvaluationOutput;
  });
}

function replaceFirstLesson(definition: DomainDefinition, patch: Partial<LessonDefinition>): DomainDefinition {
  return {
    ...definition,
    lessons: [{ ...definition.lessons[0], ...patch }, definition.lessons[1], definition.lessons[2]],
  };
}

describe("curriculum registry", () => {
  it("composes domain-scoped lessons, defaults, and their evaluators", () => {
    const phase = module("phase-proportion", ["shared", "phase-two", "phase-three"]);
    const rhythm = module("rhythm-meter", ["shared", "rhythm-two", "rhythm-three"]);
    const registry = createCurriculumRegistry([phase, rhythm]);

    expect(registry.catalog).toEqual([phase.definition, rhythm.definition]);
    expect(registry.defaultLesson).toBe(phase.definition.lessons[0]);
    expect(registry.domainById("rhythm-meter")).toBe(rhythm.definition);
    expect(registry.lessonById("phase-proportion", "shared")).toBe(phase.definition.lessons[0]);
    expect(registry.lessonById("rhythm-meter", "shared")).toBe(rhythm.definition.lessons[0]);
    expect(registry.evaluatorFor("rhythm-meter", "shared")({})).toEqual(evaluation);
  });

  it("rejects duplicate domain IDs and protocol IDs", () => {
    expect(() => createCurriculumRegistry([module("phase-proportion"), module("phase-proportion")])).toThrow("Duplicate domain ID: phase-proportion.");
    const duplicateProtocol = defineDomain(domain("rhythm-meter", ["one", "two", "three"], [
      "phase-proportion.one.v1", "rhythm-meter.two.v1", "rhythm-meter.three.v1",
    ]), {
      one: () => evaluation,
      two: () => evaluation,
      three: () => evaluation,
    });

    expect(() => createCurriculumRegistry([module("phase-proportion"), duplicateProtocol])).toThrow("Duplicate protocol ID: phase-proportion.one.v1.");
  });

  it("rejects duplicate composite lesson keys and mismatched evaluator sets", () => {
    expect(() => defineDomain(domain("phase-proportion", ["one", "two", "one"]), {
      one: () => evaluation,
      two: () => evaluation,
      three: () => evaluation,
    })).toThrow("Duplicate lesson key: phase");

    expect(() => defineDomain(domain("phase-proportion"), {
      one: () => evaluation,
      two: () => evaluation,
      extra: () => evaluation,
    } as never)).toThrow("must match its three lesson IDs exactly");
  });

  it("preserves the current unregistered-lesson error and rejects non-finite evaluation output", () => {
    const registry = createCurriculumRegistry([module("phase-proportion")]);
    expect(() => registry.evaluatorFor("phase-proportion", "missing")).toThrowError(
      new RangeError("No evaluator is registered for lesson missing."),
    );

    const invalid = defineDomain(domain("ensemble-dynamics"), {
      one: () => ({ ...evaluation, trace: [{ x: Number.NaN, y: 1, series: "ensemble-dynamics" }] }),
      two: () => evaluation,
      three: () => evaluation,
    });
    const invalidRegistry = createCurriculumRegistry([invalid]);
    expect(() => invalidRegistry.evaluatorFor("ensemble-dynamics", "one")({})).toThrow("finite EvaluationOutput");
  });

  it("requires unique and valid lesson factors plus finite positive protocol duration", () => {
    const numberFactor = {
      id: "tempo", kind: "number" as const, label: "Tempo", min: 1, max: 10, step: 1, defaultValue: 5, help: "Synthetic.",
    };
    const selectFactor = {
      id: "mode", kind: "select" as const, label: "Mode", defaultValue: "a",
      options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], help: "Synthetic.",
    };

    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { factors: [numberFactor, { ...numberFactor }] })))
      .toThrow("duplicate factor ID: tempo");
    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { factors: [{ ...numberFactor, step: 0 }] })))
      .toThrow("finite bounds, an in-range default, and a positive step");
    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { factors: [{ ...numberFactor, min: Number.NEGATIVE_INFINITY }] })))
      .toThrow("finite bounds, an in-range default, and a positive step");
    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { factors: [{ ...numberFactor, defaultValue: 11 }] })))
      .toThrow("finite bounds, an in-range default, and a positive step");
    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), {
      factors: [{ ...selectFactor, options: [{ value: "a", label: "A" }, { value: "a", label: "Again" }] }],
    }))).toThrow("duplicate option: a");
    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { factors: [{ ...selectFactor, defaultValue: "missing" }] })))
      .toThrow("must use one of its options as the default");
    expect(() => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), {
      protocol: { ...domain("timbre-acoustics").lessons[0].protocol, durationSeconds: 0 },
    }))).toThrow("finite positive protocol duration");
  });

  it("resolves lesson and claim evidence references when evidence is supplied", () => {
    const claim = { id: "model.deterministic", sourceIds: ["synthetic"] } as unknown as ClaimRecord;
    const evidence = {
      claimById: (id: string) => (id === claim.id ? claim : undefined),
      sourceById: (id: string) => (id === "synthetic" ? ({ id } as unknown as ResearchSource) : undefined),
    };

    expect(() => createCurriculumRegistry([module("timbre-acoustics")], { evidence })).not.toThrow();
    expect(() => createCurriculumRegistry([moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { claimIds: ["missing"] }))], { evidence }))
      .toThrow("references unknown claim: missing");
    expect(() => createCurriculumRegistry([moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), { sourceIds: ["missing"] }))], { evidence }))
      .toThrow("references unknown source: missing");
    expect(() => createCurriculumRegistry([module("timbre-acoustics")], {
      evidence: { ...evidence, claimById: () => ({ ...claim, sourceIds: ["missing"] }) },
    })).toThrow("Claim model.deterministic references unknown source: missing");
  });

  it("validates audio settings against input modes, factor kinds, and uniqueness", () => {
    const numberFactor = {
      id: "threshold", kind: "number" as const, label: "Threshold", min: 0, max: 1, step: 0.1, defaultValue: 0.5, help: "Synthetic.",
      audioSetting: "onsetSensitivity" as const,
    };
    const selectFactor = {
      id: "bias", kind: "select" as const, label: "Bias", defaultValue: "mixed", help: "Synthetic.",
      options: [{ value: "mixed", label: "Mixed" }, { value: "duple", label: "Duple" }, { value: "triple", label: "Triple" }],
      audioSetting: "meterBias" as const,
    };
    const audio = { inputModes: ["synthetic" as const, "file" as const] };
    const lessonWith = (patch: Partial<LessonDefinition>) => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), patch));

    expect(() => lessonWith({ ...audio, factors: [numberFactor, selectFactor] })).not.toThrow();
    expect(() => lessonWith({ factors: [numberFactor] })).toThrow("accepts neither microphone nor file input");
    expect(() => lessonWith({ ...audio, factors: [numberFactor, { ...numberFactor, id: "other" }] }))
      .toThrow("more than one factor");
    expect(() => lessonWith({ ...audio, factors: [{ ...selectFactor, audioSetting: "onsetSensitivity" } as never] }))
      .toThrow("requires a number factor");
    expect(() => lessonWith({ ...audio, factors: [{ ...numberFactor, audioSetting: "meterBias" } as never] }))
      .toThrow("requires a select factor");
    expect(() => lessonWith({
      ...audio,
      factors: [{ ...selectFactor, options: [{ value: "mixed", label: "Mixed" }, { value: "quadruple", label: "Quad" }] }],
    })).toThrow("only mixed, duple, or triple options");
  });

  it("rejects unknown audio settings and audio settings on toggle factors", () => {
    const audio = { inputModes: ["synthetic" as const, "file" as const] };
    const lessonWith = (patch: Partial<LessonDefinition>) => moduleFrom(replaceFirstLesson(domain("timbre-acoustics"), patch));
    const numberFactor = { id: "threshold", kind: "number", label: "Threshold", min: 0, max: 1, step: 0.1, defaultValue: 0.5, help: "Synthetic." };
    const toggleFactor = { id: "flag", kind: "toggle", label: "Flag", defaultValue: false, help: "Synthetic." };

    expect(() => lessonWith({ ...audio, factors: [{ ...numberFactor, audioSetting: "gain" }] } as unknown as Partial<LessonDefinition>))
      .toThrow("unknown audio setting gain");
    expect(() => lessonWith({ ...audio, factors: [{ ...toggleFactor, audioSetting: "onsetSensitivity" }] } as unknown as Partial<LessonDefinition>))
      .toThrow("requires a number or select factor");
    expect(() => lessonWith({ ...audio, factors: [{ ...toggleFactor, audioSetting: "meterBias" }] } as unknown as Partial<LessonDefinition>))
      .toThrow("requires a number or select factor");
  });

  it("accepts only supported aggregation values and bounded integer precision", () => {
    expect(isEvaluationOutput({
      ...evaluation,
      observables: [{ ...evaluation.observables[0], aggregation: "unsupported" }],
    })).toBe(false);
    expect(isEvaluationOutput({
      ...evaluation,
      observables: [{ ...evaluation.observables[0], precision: 1.5 }],
    })).toBe(false);
    expect(isEvaluationOutput({
      ...evaluation,
      observables: [{ ...evaluation.observables[0], precision: 101 }],
    })).toBe(false);
  });
});

function moduleFrom(definition: DomainDefinition) {
  return defineDomain(definition, Object.fromEntries(definition.lessons.map((item) => [item.id, () => evaluation])) as never);
}
