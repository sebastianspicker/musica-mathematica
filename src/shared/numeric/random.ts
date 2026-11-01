export type RandomSource = () => number;

/** Creates a reproducible Mulberry32 pseudo-random source from a 32-bit seed. */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed)) throw new RangeError("seed must be an integer.");
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
