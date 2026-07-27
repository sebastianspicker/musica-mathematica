import { assertSupportedFrameSize } from "./contracts";

export function hannWindow(size: number): Float64Array {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new RangeError("window size must be a positive safe integer");
  }
  if (size === 1) {
    return Float64Array.of(1);
  }
  return Float64Array.from(
    { length: size },
    (_, index) => 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1))),
  );
}

export function applyWindow(samples: ArrayLike<number>, window: ArrayLike<number>): Float64Array {
  if (samples.length !== window.length) {
    throw new RangeError("samples and window must have the same length");
  }
  return Float64Array.from({ length: samples.length }, (_, index) => samples[index] * window[index]);
}

export function frameAudio(
  samples: ArrayLike<number>,
  frameSize: 2048 | 4096,
  overlapRatio = 0.5,
): Float32Array[] {
  assertSupportedFrameSize(frameSize);
  if (!Number.isFinite(overlapRatio) || overlapRatio < 0 || overlapRatio >= 1) {
    throw new RangeError("overlapRatio must be at least zero and less than one");
  }
  const hopSize = Math.round(frameSize * (1 - overlapRatio));
  if (samples.length < frameSize) {
    return [];
  }
  const frames: Float32Array[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    frames.push(Float32Array.from({ length: frameSize }, (_, index) => samples[start + index]));
  }
  return frames;
}
