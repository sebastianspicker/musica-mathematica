import { applyWindow, hannWindow } from "./windowing";

export type Spectrum = Readonly<{
  fftSize: number;
  sampleRateHz: number;
  binWidthHz: number;
  frequenciesHz: Float64Array;
  magnitudes: Float64Array;
  powers: Float64Array;
}>;

export type FftJsLike = Readonly<{
  createComplexArray(): ArrayLike<number> & { [index: number]: number };
  realTransform(output: ArrayLike<number> & { [index: number]: number }, input: ArrayLike<number>): void;
}>;

export type FftJsConstructor = new (size: number) => FftJsLike;

export type SpectrumAnalyzer = (samples: ArrayLike<number>, sampleRateHz: number) => Spectrum;

function assertSpectrumInput(samples: ArrayLike<number>, sampleRateHz: number): void {
  if (!Number.isSafeInteger(samples.length) || samples.length < 2 || (samples.length & (samples.length - 1)) !== 0) {
    throw new RangeError("FFT input length must be a power of two of at least two samples");
  }
  if (!Number.isFinite(sampleRateHz) || sampleRateHz <= 0) {
    throw new RangeError("sampleRateHz must be positive and finite");
  }
}

/** Adapts fft.js's realTransform API while keeping the dependency isolated at one boundary. */
export function createFftJsSpectrumAnalyzer(FFT: FftJsConstructor): SpectrumAnalyzer {
  const analyzer = new FftJsSpectrumAnalyzer(FFT);
  return analyzer.analyze.bind(analyzer);
}

class FftJsSpectrumAnalyzer {
  constructor(private readonly FFT: FftJsConstructor) {}

  analyze(samples: ArrayLike<number>, sampleRateHz: number): Spectrum {
    return buildSpectrum(this.FFT, samples, sampleRateHz);
  }
}

function buildSpectrum(FFT: FftJsConstructor, samples: ArrayLike<number>, sampleRateHz: number): Spectrum {
  assertSpectrumInput(samples, sampleRateHz);
  const fftSize = samples.length;
  const engine = new FFT(fftSize);
  const output = engine.createComplexArray();
  engine.realTransform(output, applyWindow(samples, hannWindow(fftSize)));
  return spectrumFromTransform(output, fftSize, sampleRateHz);
}

const spectrumFromTransform = (output: ArrayLike<number>, fftSize: number, sampleRateHz: number): Spectrum => {
  const binCount = fftSize / 2 + 1;
  const coherentGain = fftSize > 2 ? (fftSize - 1) / (2 * fftSize) : 0.5;
  const magnitudes = new Float64Array(binCount);
  const powers = new Float64Array(binCount);
  const frequenciesHz = new Float64Array(binCount);
  const binWidthHz = sampleRateHz / fftSize;
  for (let bin = 0; bin < binCount; bin += 1) {
    const magnitude = normalizedBinMagnitude(output, bin, fftSize, coherentGain);
    magnitudes[bin] = magnitude;
    powers[bin] = magnitude * magnitude;
    frequenciesHz[bin] = bin * binWidthHz;
  }
  return Object.freeze({ fftSize, sampleRateHz, binWidthHz, frequenciesHz, magnitudes, powers });
};

const normalizedBinMagnitude = (output: ArrayLike<number>, bin: number, fftSize: number, coherentGain: number): number => {
  const real = output[2 * bin] ?? 0;
  const imaginary = output[2 * bin + 1] ?? 0;
  const edgeScale = bin === 0 || bin === fftSize / 2 ? 1 : 2;
  return (edgeScale * Math.hypot(real, imaginary)) / (fftSize * coherentGain);
};
