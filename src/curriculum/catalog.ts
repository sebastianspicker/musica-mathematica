import { claimById, sourceById } from "./evidence";
import { createCurriculumRegistry } from "./registry";
import { ensembleDynamicsDomain } from "../domains/ensemble-dynamics";
import { harmonyGeometryDomain } from "../domains/harmony-geometry";
import { measurementInferenceDomain } from "../domains/measurement-inference";
import { phaseProportionDomain } from "../domains/phase-proportion";
import { pitchTuningDomain } from "../domains/pitch-tuning";
import { probabilityFormDomain } from "../domains/probability-form";
import { rhythmMeterDomain } from "../domains/rhythm-meter";
import { timbreAcousticsDomain } from "../domains/timbre-acoustics";

/** Canonical composition root for the curriculum and its evaluators. */
export const curriculumRegistry = createCurriculumRegistry([
  phaseProportionDomain,
  ensembleDynamicsDomain,
  rhythmMeterDomain,
  pitchTuningDomain,
  harmonyGeometryDomain,
  timbreAcousticsDomain,
  probabilityFormDomain,
  measurementInferenceDomain,
], { evidence: { claimById, sourceById } });
