import { describe, expect, it } from "vitest";
import type { AudioFrame } from "../analysis/contracts";
import { AudioFrameSequenceTracker } from "./frameQueue";

function frame(sequence: number, droppedBefore = 0): AudioFrame {
  return {
    sequence,
    startSample: sequence * 4,
    sampleRateHz: 48_000,
    samples: new Float32Array(4),
    droppedBefore,
  };
}

describe("audio frame sequence tracker", () => {
  it("reports gaps without double counting", () => {
    const queue = new AudioFrameSequenceTracker();
    queue.accept(frame(0));
    queue.accept(frame(3, 2));
    queue.accept(frame(4));

    expect(queue.getStatus()).toEqual({
      accepted: true,
      staleFrames: 0,
      sequenceGaps: 2,
    });
    expect(queue.accept(frame(4)).accepted).toBe(false);
    expect(queue.getStatus().staleFrames).toBe(1);
  });
});
