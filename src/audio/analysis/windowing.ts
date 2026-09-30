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
