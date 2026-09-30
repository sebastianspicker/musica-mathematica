import type { CurriculumLessonReader } from "../../curriculum/contracts";
import { lessonStages } from "../stages";
import {
  attemptKey,
  maximumPortfolioJsonBytes,
  traceCompactionTiers,
  type LearningPortfolioV2,
  type LessonAttemptV2,
} from "./schema";
import { capTrace, isLearningPortfolioV2, normalizePortfolio, sameJson } from "./validate";

export type PortfolioNormalizationStatus =
  | "unchanged"
  | "normalized"
  | "compacted"
  | "invalid"
  | "blocked";

export type PreparedPortfolio = Readonly<{
  portfolio?: LearningPortfolioV2;
  json?: string;
  byteLength?: number;
  normalizationStatus: PortfolioNormalizationStatus;
}>;

export function preparePortfolio(
  value: unknown,
  curriculum: CurriculumLessonReader,
): PreparedPortfolio {
  const normalized = normalizePortfolio(value, curriculum);
  if (!normalized) return { normalizationStatus: "invalid" };

  let portfolio = normalized;
  let serialized = JSON.stringify(portfolio);
  const wasNormalized = !sameJson(value, portfolio);
  if (utf8ByteLength(serialized) <= maximumPortfolioJsonBytes) {
    return prepared(
      portfolio,
      serialized,
      wasNormalized ? "normalized" : "unchanged",
      curriculum,
    );
  }

  for (const traceLimit of traceCompactionTiers) {
    portfolio = withTraceLimit(portfolio, traceLimit);
    serialized = JSON.stringify(portfolio);
    if (utf8ByteLength(serialized) <= maximumPortfolioJsonBytes) {
      return prepared(portfolio, serialized, "compacted", curriculum);
    }
  }

  let reducedTrials = withoutOldestExcessTrial(portfolio);
  while (reducedTrials) {
    const reduced = reducedTrials;
    portfolio = reduced;
    serialized = JSON.stringify(portfolio);
    if (utf8ByteLength(serialized) <= maximumPortfolioJsonBytes) {
      return prepared(portfolio, serialized, "compacted", curriculum);
    }
    reducedTrials = withoutOldestExcessTrial(portfolio);
  }

  let reducedAttempts = withoutOldestNonactiveAttempt(portfolio);
  while (reducedAttempts) {
    const reduced = reducedAttempts;
    portfolio = reduced;
    serialized = JSON.stringify(portfolio);
    if (utf8ByteLength(serialized) <= maximumPortfolioJsonBytes) {
      return prepared(portfolio, serialized, "compacted", curriculum);
    }
    reducedAttempts = withoutOldestNonactiveAttempt(portfolio);
  }

  return {
    portfolio,
    byteLength: utf8ByteLength(serialized),
    normalizationStatus: "blocked",
  };
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function prepared(
  portfolio: LearningPortfolioV2,
  json: string,
  normalizationStatus: PortfolioNormalizationStatus,
  curriculum: CurriculumLessonReader,
): PreparedPortfolio {
  if (!isLearningPortfolioV2(portfolio, curriculum)) {
    throw new TypeError("Prepared portfolio must remain schema-valid.");
  }
  return {
    portfolio,
    json,
    byteLength: utf8ByteLength(json),
    normalizationStatus,
  };
}

function withTraceLimit(
  portfolio: LearningPortfolioV2,
  maximumPoints: number,
): LearningPortfolioV2 {
  return {
    ...portfolio,
    attempts: Object.fromEntries(Object.entries(portfolio.attempts).map(([key, attempt]) => [
      key,
      {
        ...attempt,
        trials: attempt.trials.map((trial) => ({
          ...trial,
          trace: capTrace(trial.trace, maximumPoints),
        })),
      },
    ])),
  };
}

function withoutOldestExcessTrial(
  portfolio: LearningPortfolioV2,
): LearningPortfolioV2 | undefined {
  let candidate: { key: string; recordedAt: string } | undefined;
  for (const [key, attempt] of Object.entries(portfolio.attempts)) {
    if (attempt.trials.length <= requiredTrialCount(attempt)) continue;
    const recordedAt = attempt.trials[0]?.recordedAt;
    if (!recordedAt) continue;
    if (!candidate || Date.parse(recordedAt) < Date.parse(candidate.recordedAt)
      || (recordedAt === candidate.recordedAt && key < candidate.key)) {
      candidate = { key, recordedAt };
    }
  }
  if (!candidate) return undefined;
  const attempt = portfolio.attempts[candidate.key];
  if (!attempt) return undefined;
  return replaceAttempt(portfolio, candidate.key, { ...attempt, trials: attempt.trials.slice(1) });
}

function withoutOldestNonactiveAttempt(
  portfolio: LearningPortfolioV2,
): LearningPortfolioV2 | undefined {
  const activeKey = attemptKey(portfolio.active.labId, portfolio.active.lessonId);
  const candidate = Object.entries(portfolio.attempts)
    .filter(([key]) => key !== activeKey)
    .sort(([leftKey, left], [rightKey, right]) =>
      Date.parse(left.updatedAt) - Date.parse(right.updatedAt) || leftKey.localeCompare(rightKey),
    )[0];
  if (!candidate) return undefined;
  const attempts = { ...portfolio.attempts };
  delete attempts[candidate[0]];
  return { ...portfolio, attempts };
}

function replaceAttempt(
  portfolio: LearningPortfolioV2,
  key: string,
  attempt: LessonAttemptV2,
): LearningPortfolioV2 {
  return { ...portfolio, attempts: { ...portfolio.attempts, [key]: attempt } };
}

function requiredTrialCount(attempt: LessonAttemptV2): number {
  return lessonStages.indexOf(attempt.stage) >= lessonStages.indexOf("compare") ? 2 : 0;
}
