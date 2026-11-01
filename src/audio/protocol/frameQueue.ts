import type { AudioFrame, QueueStatus } from "../analysis/contracts";

/** Tracks stale frames and sequence gaps; backpressure is enforced by worklet credits. */
export class AudioFrameSequenceTracker {
  private lastSequence: number | null = null;
  private staleFrames = 0;
  private sequenceGaps = 0;

  accept(frame: AudioFrame): QueueStatus {
    if (!Number.isSafeInteger(frame.sequence) || frame.sequence < 0) {
      throw new RangeError("frame.sequence must be a non-negative safe integer");
    }
    if (this.lastSequence !== null && frame.sequence <= this.lastSequence) {
      this.staleFrames += 1;
      return this.status(false);
    }
    const inferredGap = this.lastSequence === null
      ? frame.sequence
      : Math.max(0, frame.sequence - this.lastSequence - 1);
    // `droppedBefore` and the sequence delta normally describe the same worklet
    // frames. Count the larger report so a known gap is visible without double
    // counting it.
    this.sequenceGaps += Math.max(inferredGap, Math.max(0, frame.droppedBefore));
    this.lastSequence = frame.sequence;
    return this.status(true);
  }

  getStatus(): QueueStatus {
    return this.status(true);
  }

  private status(accepted: boolean): QueueStatus {
    return Object.freeze({
      accepted,
      staleFrames: this.staleFrames,
      sequenceGaps: this.sequenceGaps,
    });
  }
}
