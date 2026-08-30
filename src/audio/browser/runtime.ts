import captureProcessorModuleUrl from "./worklets/captureProcessor.ts?worker&url";

/**
 * Browser-only entry points kept in Vite-recognized forms so the analysis
 * worker and AudioWorklet are emitted as executable production build assets.
 */
export { captureProcessorModuleUrl };

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
