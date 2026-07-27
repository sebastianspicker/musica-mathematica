import { describe, expect, it } from "vitest";
import { isLatencyPipeline, latencyPipelineTotalSeconds } from "./latencyPipeline";

const pipeline = {
  captureSeconds: 0.002,
  sendBufferSeconds: 0.003,
  networkSeconds: 0.01,
  jitterBufferSeconds: 0.004,
  playbackSeconds: 0.006,
};

describe("latency pipeline", () => {
  it("sums each explicit path segment", () => {
    expect(latencyPipelineTotalSeconds(pipeline)).toBeCloseTo(0.025);
  });

  it("rejects missing, negative, and non-finite segments", () => {
    expect(isLatencyPipeline({ ...pipeline, networkSeconds: -0.001 })).toBe(false);
    expect(isLatencyPipeline({ ...pipeline, playbackSeconds: Number.NaN })).toBe(false);
    expect(isLatencyPipeline({ captureSeconds: 0 })).toBe(false);
    expect(() => latencyPipelineTotalSeconds({ ...pipeline, networkSeconds: -0.001 })).toThrow(
      "Latency pipeline segments",
    );
  });
});
