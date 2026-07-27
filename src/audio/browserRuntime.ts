/**
 * Browser-only entry points kept in literal Vite-recognized forms so the
 * analysis worker and AudioWorklet are emitted as production build assets.
 */
export const captureProcessorModuleUrl = new URL(
  "./worklets/captureProcessor.ts",
  import.meta.url,
);

export function createStreamingAnalysisWorker(): Worker {
  return new Worker(new URL("./analysisWorker.ts", import.meta.url), {
    type: "module",
    name: "musica-mathematica-audio-analysis",
  });
}

export function createSelectionAnalysisWorker(): Worker {
  return new Worker(new URL("./analysisWorker.ts", import.meta.url), {
    type: "module",
    name: "musica-mathematica-selection-analysis",
  });
}
