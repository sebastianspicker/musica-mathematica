import { isLessonStage, lessonStages } from "../../stages";
import type {
  LegacyEnsembleConfig,
  LegacyEnsembleMetrics,
  LegacyRunSnapshot,
  LessonAttemptV1,
} from "./schema";

export function isLessonAttemptV1(value: unknown): value is LessonAttemptV1 {
  if (!record(value) || value.version !== 1 || typeof value.lessonId !== "string" || !value.lessonId.trim() || !isLessonStage(value.stage) || !Array.isArray(value.runs) || !value.runs.every(isRun) || ![value.prediction, value.explanation, value.performanceReflection, value.transferResponse].every(optionalText)) return false;
  const i = lessonStages.indexOf(value.stage);
  return (i === 0 ? value.prediction === undefined : i < lessonStages.indexOf("experiment") || text(value.prediction)) && (value.runs.length === 0 || i >= lessonStages.indexOf("experiment")) && (i < lessonStages.indexOf("compare") || value.runs.length >= 2) && (i < lessonStages.indexOf("perform") || text(value.explanation)) && (i < lessonStages.indexOf("transfer") || text(value.performanceReflection)) && (i < lessonStages.indexOf("debrief") || text(value.transferResponse));
}
const isRun = (value: unknown): value is LegacyRunSnapshot => record(value) && text(value.id) && finite(value.durationSeconds) && value.durationSeconds > 0 && isConfig(value.config) && isMetrics(value.metrics, value.config) && (value.note === undefined || typeof value.note === "string");
const isConfig = (value: unknown): value is LegacyEnsembleConfig => { if (!record(value)) return false; const candidate = value as unknown as LegacyEnsembleConfig; return Number.isInteger(candidate.musicianCount) && candidate.musicianCount >= 2 && [candidate.tempoBpm, candidate.tempoSpreadBpm, candidate.couplingStrength, candidate.latencySeconds, candidate.jitterSeconds, candidate.clickTrackStrength].every(finite) && ["all-to-all", "leader-follower", "sections", "click-track"].includes(String(candidate.topology)) && ["pulse", "dense-rhythm", "call-response", "drone", "rubato"].includes(String(candidate.repertoireTexture)); };
const isMetrics = (value: unknown, config: LegacyEnsembleConfig): value is LegacyEnsembleMetrics => { if (!record(value)) return false; const candidate = value as unknown as LegacyEnsembleMetrics; return [candidate.coherence, candidate.phaseSpread, candidate.phaseSpreadEquivalentMs, candidate.peerCouplingShare, candidate.modelLatencyBudgetSeconds].every(finite) && candidate.coherence >= 0 && candidate.coherence <= 1 && candidate.phaseSpread >= 0 && candidate.phaseSpread <= Math.PI && candidate.phaseSpreadEquivalentMs >= 0 && candidate.peerCouplingShare >= 0 && candidate.peerCouplingShare <= 1 && candidate.modelLatencyBudgetSeconds > 0 && (config.topology === "leader-follower" ? finite(candidate.leaderToFollowerPhaseLagMs) : candidate.leaderToFollowerPhaseLagMs === null) && (config.topology === "sections" ? Array.isArray(candidate.sectionCoherences) && candidate.sectionCoherences.every((item) => finite(item) && item >= 0 && item <= 1) : candidate.sectionCoherences === null); };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const optionalText = (value: unknown): boolean => value === undefined || text(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
