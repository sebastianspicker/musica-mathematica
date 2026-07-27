export function assertPositiveFinite(name: string, value: number): void {
  assertValidNumber(name, !Number.isFinite(value) || value <= 0, "a positive finite number");
}

export function assertNonNegativeFinite(name: string, value: number): void {
  assertValidNumber(name, !Number.isFinite(value) || value < 0, "a non-negative finite number");
}

export function assertPositiveInteger(name: string, value: number): void {
  assertValidNumber(name, !Number.isSafeInteger(value) || value <= 0, "a positive safe integer");
}

export function assertNonEmptyFiniteNumbers(values: ArrayLike<number>, name: string): void {
  if (values.length === 0) throw new RangeError(`${name} must not be empty`);
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      throw new RangeError(`${name} must contain only finite numbers`);
    }
  }
}

export function assertFiniteNonNegative(name: string, value: number): void {
  assertValidNumber(name, !Number.isFinite(value) || value < 0, "a finite non-negative number.");
}

export function assertFinitePositive(name: string, value: number): void {
  assertValidNumber(name, !Number.isFinite(value) || value <= 0, "a finite positive number.");
}

function assertValidNumber(name: string, invalid: boolean, requirement: string): void {
  if (invalid) throw new RangeError(`${name} must be ${requirement}`);
}
