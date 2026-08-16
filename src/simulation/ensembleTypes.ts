export type Oscillator = {
  phase: number;
  omega: number;
};

export type CouplingEdge = {
  from: number;
  to: number;
  strength: number;
  delaySeconds: number;
};

export type EnsembleState = {
  time: number;
  oscillators: Oscillator[];
};
