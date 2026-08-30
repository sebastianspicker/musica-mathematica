import { AUDIO_ANALYSIS_LIMITS, type AudioFrame, type QueueStatus } from "../analysis/contracts";

/** Bounded streaming queue with explicit stale, overflow, and gap accounting. */
export class BoundedAudioFrameQueue {
  private readonly frames: AudioFrame[] = [];
  private lastSequence: number | null = null;
  private staleFrames = 0;
  private overflowFrames = 0;
  private sequenceGaps = 0;

  constructor(private readonly capacity: number = AUDIO_ANALYSIS_LIMITS.defaultQueueCapacity) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive safe integer");
    }
  }

  push(frame: AudioFrame): QueueStatus {
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
    this.frames.push(frame);
    while (this.frames.length > this.capacity) {
      this.frames.shift();
      this.overflowFrames += 1;
    }
    return this.status(true);
  }

  shift(): AudioFrame | undefined {
    return this.frames.shift();
  }

  drain(): AudioFrame[] {
    return this.frames.splice(0, this.frames.length);
  }

  getStatus(): QueueStatus {
    return this.status(true);
  }

  private status(accepted: boolean): QueueStatus {
    return Object.freeze({
      accepted,
      staleFrames: this.staleFrames,
      overflowFrames: this.overflowFrames,
      sequenceGaps: this.sequenceGaps,
      queuedFrames: this.frames.length,
    });
  }
}
