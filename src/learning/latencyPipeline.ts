export type LatencyPipeline = {
  captureSeconds: number;
  sendBufferSeconds: number;
  networkSeconds: number;
  jitterBufferSeconds: number;
  playbackSeconds: number;
};

const latencySegments: readonly (keyof LatencyPipeline)[] = [
  "captureSeconds",
  "sendBufferSeconds",
  "networkSeconds",
  "jitterBufferSeconds",
  "playbackSeconds",
];

export function isLatencyPipeline(value: unknown): value is LatencyPipeline {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return latencySegments.every(
    (segment) => typeof candidate[segment] === "number" && Number.isFinite(candidate[segment]) && candidate[segment] >= 0,
  );
}

export function latencyPipelineTotalSeconds(pipeline: LatencyPipeline): number {
  if (!isLatencyPipeline(pipeline)) {
    throw new Error("Latency pipeline segments must be finite values of zero or greater.");
  }
  return latencySegments.reduce((total, segment) => total + pipeline[segment], 0);
}
