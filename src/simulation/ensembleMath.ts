const TAU = Math.PI * 2;

export function normalizePhase(phase: number): number {
  const wrapped = phase % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

export function circularDifference(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function bpmToRadPerSecond(tempoBpm: number): number {
  return (tempoBpm / 60) * TAU;
}

export function initialPhaseFor(index: number, count: number): number {
  const imperfectCircle = (TAU * index) / count + 0.41 * Math.sin((index + 1) * 1.73);
  return normalizePhase(imperfectCircle);
}

export function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-9;
}
