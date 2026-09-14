import { beforeEach, describe, expect, it } from "vitest";
import { createFftJsSpectrumAnalyzer, type FftJsLike } from "./spectrum";

class CountingFft implements FftJsLike {
  static constructions: number[] = [];

  constructor(private readonly size: number) {
    CountingFft.constructions.push(size);
  }

  createComplexArray(): Float64Array {
    return new Float64Array(this.size * 2);
  }

  realTransform(output: Float64Array, input: ArrayLike<number>): void {
    output.fill(0);
    output[2] = input[0] ?? 0;
  }
}

beforeEach(() => {
  CountingFft.constructions = [];
});

describe("FFT spectrum analyzer scratch ownership", () => {
  it("reuses bounded frame-size scratch while returning independently owned spectra", () => {
    const analyze = createFftJsSpectrumAnalyzer(CountingFft);
    const first = analyze(Float32Array.from({ length: 2_048 }, () => 0.5), 48_000);
    const second = analyze(Float32Array.from({ length: 2_048 }, () => 0.25), 48_000);
    analyze(new Float32Array(4_096), 48_000);
    analyze(new Float32Array(4_096), 48_000);

    expect(CountingFft.constructions).toEqual([2_048, 4_096]);
    expect(second.frequenciesHz).not.toBe(first.frequenciesHz);
    expect(second.magnitudes).not.toBe(first.magnitudes);
    expect(second.powers).not.toBe(first.powers);

    first.frequenciesHz[1] = -1;
    first.magnitudes[1] = -1;
    first.powers[1] = -1;
    expect(second.frequenciesHz[1]).toBeGreaterThan(0);
    expect(second.magnitudes[1]).toBeGreaterThanOrEqual(0);
    expect(second.powers[1]).toBeGreaterThanOrEqual(0);
  });
});
