import FFT from "fft.js";
import { createFftJsSpectrumAnalyzer } from "./spectrum";

/** Production spectrum analyzer. Kept isolated so fft.js is the only replaceable runtime boundary. */
export const analyzeSpectrumWithFftJs = createFftJsSpectrumAnalyzer(FFT);
