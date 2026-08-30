import { describe, expect, it } from "vitest";
import type { AudioFrame } from "../analysis/contracts";
import { BoundedAudioFrameQueue } from "./frameQueue";

function frame(sequence: number, droppedBefore = 0): AudioFrame {
  return {
    sequence,
    startSample: sequence * 4,
    sampleRateHz: 48_000,
    samples: new Float32Array(4),
    droppedBefore,
  };
}

describe("bounded streaming protocol queue", () => {
  it("keeps the newest bounded frames and reports gaps without double counting", () => {
    const queue = new BoundedAudioFrameQueue(2);
    queue.push(frame(0));
    queue.push(frame(3, 2));
    queue.push(frame(4));

    expect(queue.getStatus()).toEqual({
      accepted: true,
      staleFrames: 0,
      overflowFrames: 1,
      sequenceGaps: 2,
      queuedFrames: 2,
    });
    expect(queue.push(frame(4)).accepted).toBe(false);
    expect(queue.getStatus().staleFrames).toBe(1);
    expect(queue.drain().map(({ sequence }) => sequence)).toEqual([3, 4]);
  });
});
