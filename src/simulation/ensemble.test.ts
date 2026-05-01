import { describe, expect, it } from "vitest";
import {
  type EnsembleConfig,
  bpmToRadPerSecond,
  configsEqual,
  createInitialState,
  modelLatencyBudgetSeconds,
  modelLatencyBudgetStatus,
  peerCouplingShare,
  retuneState,
  simulateEnsemble,
} from "./ensemble";
import { defaultConfig } from "./presets";

function run(config: Partial<EnsembleConfig>, seconds = 18): number {
  return simulateEnsemble({ ...defaultConfig, ...config }, seconds).finalMetrics.coherence;
}

function omegaSpan(config: EnsembleConfig): number {
  const state = createInitialState(config);
  const omegas = state.oscillators.map((oscillator) => oscillator.omega);
  return Math.max(...omegas) - Math.min(...omegas);
}

describe("ensemble simulation invariants", () => {
  it("identical tempos with strong coupling converge toward lock-in", () => {
    const coherence = run({
      tempoSpreadBpm: 0,
      couplingStrength: 2.5,
      latencySeconds: 0,
      jitterSeconds: 0,
      clickTrackStrength: 0,
      topology: "all-to-all",
    });

    expect(coherence).toBeGreaterThan(0.92);
  });

  it("wide tempo spread with weak coupling stays incoherent", () => {
    const coherence = run({
      tempoSpreadBpm: 18,
      couplingStrength: 0.08,
      latencySeconds: 0,
      jitterSeconds: 0,
      clickTrackStrength: 0,
      topology: "all-to-all",
    });

    expect(coherence).toBeLessThan(0.55);
  });

  it("stable latency lowers coherence after the model budget is exceeded", () => {
    const base: Partial<EnsembleConfig> = {
      tempoBpm: 120,
      tempoSpreadBpm: 5,
      couplingStrength: 1.8,
      jitterSeconds: 0,
      clickTrackStrength: 0,
      topology: "all-to-all",
    };

    const lowLatency = run({ ...base, latencySeconds: 0.015 });
    const highLatency = run({ ...base, latencySeconds: 0.16 });

    expect(lowLatency - highLatency).toBeGreaterThan(0.2);
  });

  it("jitter damages coherence more than the same mean stable delay", () => {
    const base: Partial<EnsembleConfig> = {
      tempoBpm: 128,
      tempoSpreadBpm: 6,
      couplingStrength: 1.45,
      clickTrackStrength: 0,
      topology: "leader-follower",
    };

    const stable = run({ ...base, latencySeconds: 0.055, jitterSeconds: 0 });
    const jittered = run({ ...base, latencySeconds: 0.055, jitterSeconds: 0.035 });

    expect(stable - jittered).toBeGreaterThan(0.08);
  });

  it("click track improves timing precision but reduces peer-coupling share", () => {
    const noClickConfig: EnsembleConfig = {
      ...defaultConfig,
      tempoSpreadBpm: 12,
      couplingStrength: 0.22,
      latencySeconds: 0.04,
      topology: "all-to-all",
      clickTrackStrength: 0,
    };
    const clickConfig: EnsembleConfig = {
      ...noClickConfig,
      topology: "click-track",
      clickTrackStrength: 2.2,
    };

    const noClick = simulateEnsemble(noClickConfig, 18).finalMetrics;
    const click = simulateEnsemble(clickConfig, 18).finalMetrics;

    expect(click.coherence).toBeGreaterThan(noClick.coherence + 0.2);
    expect(peerCouplingShare(clickConfig)).toBeLessThan(peerCouplingShare(noClickConfig));
  });

  it("initial state keeps the requested musician count", () => {
    const state = createInitialState({ ...defaultConfig, musicianCount: 11 });
    expect(state.oscillators).toHaveLength(11);
  });

  it("retunes tempo without resetting phase or time", () => {
    const state = {
      time: 4.25,
      oscillators: createInitialState({ ...defaultConfig, tempoBpm: 96 }).oscillators,
    };

    const retuned = retuneState(state, {
      ...defaultConfig,
      tempoBpm: 144,
      tempoSpreadBpm: 0,
    });

    expect(retuned.time).toBe(state.time);
    expect(retuned.oscillators[0]?.phase).toBe(state.oscillators[0]?.phase);
    expect(retuned.oscillators[0]?.omega).toBeCloseTo(bpmToRadPerSecond(144));
  });

  it("retunes tempo spread without rebuilding phases", () => {
    const state = createInitialState({ ...defaultConfig, tempoSpreadBpm: 0 });
    const wide = retuneState(state, { ...defaultConfig, tempoSpreadBpm: 20 });
    const narrowSpan = omegaSpan({ ...defaultConfig, tempoSpreadBpm: 0 });
    const wideOmegas = wide.oscillators.map((oscillator) => oscillator.omega);
    const wideSpan = Math.max(...wideOmegas) - Math.min(...wideOmegas);

    expect(wide.oscillators[3]?.phase).toBe(state.oscillators[3]?.phase);
    expect(wideSpan).toBeGreaterThan(narrowSpan + bpmToRadPerSecond(30));
  });

  it("retunes musician count while preserving existing players", () => {
    const state = {
      time: 7,
      oscillators: createInitialState({ ...defaultConfig, musicianCount: 4 }).oscillators,
    };
    const grown = retuneState(state, { ...defaultConfig, musicianCount: 6 });

    expect(grown.time).toBe(7);
    expect(grown.oscillators).toHaveLength(6);
    expect(grown.oscillators[0]?.phase).toBe(state.oscillators[0]?.phase);
    expect(grown.oscillators[3]?.phase).toBe(state.oscillators[3]?.phase);
    expect(grown.oscillators[4]?.phase).toBe(
      createInitialState({ ...defaultConfig, musicianCount: 6 }).oscillators[4]?.phase,
    );
  });

  it("texture changes the timing budget", () => {
    const dense = modelLatencyBudgetSeconds({
      ...defaultConfig,
      repertoireTexture: "dense-rhythm",
    });
    const pulse = modelLatencyBudgetSeconds({ ...defaultConfig, repertoireTexture: "pulse" });
    const drone = modelLatencyBudgetSeconds({ ...defaultConfig, repertoireTexture: "drone" });

    expect(dense).toBeLessThan(pulse);
    expect(pulse).toBeLessThan(drone);
  });

  it("model latency budget shrinks as tempo rises", () => {
    const slow = modelLatencyBudgetSeconds({ ...defaultConfig, tempoBpm: 70 });
    const fast = modelLatencyBudgetSeconds({ ...defaultConfig, tempoBpm: 140 });

    expect(fast).toBeLessThan(slow);
  });

  it("classifies model latency-budget risk", () => {
    const config = {
      ...defaultConfig,
      tempoBpm: 120,
      repertoireTexture: "pulse" as const,
    };
    const budget = modelLatencyBudgetSeconds(config);

    expect(
      modelLatencyBudgetStatus({ ...config, latencySeconds: budget * 0.35 }, {
        modelLatencyBudgetSeconds: budget,
      }),
    ).toBe("plausible");
    expect(
      modelLatencyBudgetStatus({ ...config, latencySeconds: budget * 0.65 }, {
        modelLatencyBudgetSeconds: budget,
      }),
    ).toBe("fragile");
    expect(
      modelLatencyBudgetStatus({ ...config, latencySeconds: budget * 0.9 }, {
        modelLatencyBudgetSeconds: budget,
      }),
    ).toBe("unstable");
  });

  it("dense material has a smaller budget than call-response and drone", () => {
    const dense = modelLatencyBudgetSeconds({
      ...defaultConfig,
      repertoireTexture: "dense-rhythm",
    });
    const callResponse = modelLatencyBudgetSeconds({
      ...defaultConfig,
      repertoireTexture: "call-response",
    });
    const drone = modelLatencyBudgetSeconds({ ...defaultConfig, repertoireTexture: "drone" });

    expect(dense).toBeLessThan(callResponse);
    expect(callResponse).toBeLessThan(drone);
  });

  it("dense rhythm loses coherence sooner than drone under the same network conditions", () => {
    const base: Partial<EnsembleConfig> = {
      tempoBpm: 126,
      tempoSpreadBpm: 8,
      couplingStrength: 1.35,
      latencySeconds: 0.08,
      jitterSeconds: 0.025,
      topology: "all-to-all",
      clickTrackStrength: 0,
    };

    const drone = run({ ...base, repertoireTexture: "drone" });
    const dense = run({ ...base, repertoireTexture: "dense-rhythm" });

    expect(drone - dense).toBeGreaterThan(0.12);
  });

  it("detects whether a lesson preset has become custom exploration", () => {
    expect(configsEqual(defaultConfig, { ...defaultConfig })).toBe(true);
    expect(configsEqual(defaultConfig, { ...defaultConfig, latencySeconds: 0.05 })).toBe(false);
  });

  it("rejects non-positive simulation time steps", () => {
    expect(() => simulateEnsemble(defaultConfig, 0.1, 0)).toThrow(RangeError);
    expect(() => simulateEnsemble(defaultConfig, 0.1, -0.01)).toThrow(RangeError);
  });

  it("rejects non-finite or negative simulation durations", () => {
    expect(() => simulateEnsemble(defaultConfig, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => simulateEnsemble(defaultConfig, -1)).toThrow(RangeError);
  });
});
