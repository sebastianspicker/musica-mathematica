import { describe, expect, it } from "vitest";
import { defaultConfig, type EnsembleConfig } from "./config";
import {
  createCouplingEdges,
  createInitialState,
  delayedOscillatorPhase,
  metricsFor,
  modelLatencyBudgetSeconds,
  peerCouplingShare,
  simulateEnsemble,
  stepEnsemble,
} from "./model";

function bpmToRadPerSecond(tempoBpm: number): number {
  return (tempoBpm / 60) * Math.PI * 2;
}

function run(config: Partial<EnsembleConfig>, seconds = 18): number {
  return simulateEnsemble({ ...defaultConfig, ...config }, seconds).finalMetrics.coherence;
}

describe("ensemble simulation invariants", () => {
  it("keeps topology edge order and section strengths stable", () => {
    const config: EnsembleConfig = {
      ...defaultConfig,
      musicianCount: 3,
      topology: "sections",
      couplingStrength: 2,
      latencySeconds: 0.04,
    };

    expect(createCouplingEdges(config)).toEqual([
      { from: 0, to: 1, strength: 2, delaySeconds: 0.04 },
      { from: 0, to: 2, strength: 0.7, delaySeconds: 0.04 },
      { from: 1, to: 0, strength: 2, delaySeconds: 0.04 },
      { from: 1, to: 2, strength: 0.7, delaySeconds: 0.04 },
      { from: 2, to: 0, strength: 0.7, delaySeconds: 0.04 },
      { from: 2, to: 1, strength: 0.7, delaySeconds: 0.04 },
    ]);
    expect(createCouplingEdges({ ...config, topology: "leader-follower" })).toEqual([
      { from: 0, to: 1, strength: 2, delaySeconds: 0.04 },
      { from: 0, to: 2, strength: 2, delaySeconds: 0.04 },
    ]);
  });

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

  it("keeps peer coupling active when a click track adds external forcing", () => {
    const config: EnsembleConfig = {
      ...defaultConfig,
      musicianCount: 3,
      topology: "click-track",
      couplingStrength: 1.2,
      clickTrackStrength: 1.8,
    };

    const edges = createCouplingEdges(config);

    expect(edges).toHaveLength(6);
    expect(edges.every((edge) => edge.strength === config.couplingStrength)).toBe(true);
    expect(peerCouplingShare(config)).toBeCloseTo(0.4);
  });

  it("keeps empty oscillator metrics finite", () => {
    const metrics = metricsFor({ time: 0, oscillators: [] }, defaultConfig);

    expect(metrics.coherence).toBe(0);
    expect(metrics.phaseSpread).toBe(0);
    expect(metrics.phaseSpreadEquivalentMs).toBe(0);
    expect(metrics.leaderToFollowerPhaseLagMs).toBeNull();
    expect(metrics.sectionCoherences).toBeNull();
  });

  it("reports role-aware metrics only for the topology that defines them", () => {
    const state = {
      time: 0,
      oscillators: [
        { phase: Math.PI / 2, omega: bpmToRadPerSecond(120) },
        { phase: 0, omega: bpmToRadPerSecond(120) },
        { phase: 0, omega: bpmToRadPerSecond(120) },
        { phase: Math.PI, omega: bpmToRadPerSecond(120) },
      ],
    };

    const leaderFollower = metricsFor(state, {
      ...defaultConfig,
      topology: "leader-follower",
    });
    const sections = metricsFor(state, { ...defaultConfig, topology: "sections" });
    const allToAll = metricsFor(state, { ...defaultConfig, topology: "all-to-all" });

    expect(leaderFollower.leaderToFollowerPhaseLagMs).toBeCloseTo(125);
    expect(leaderFollower.sectionCoherences).toBeNull();
    expect(sections.leaderToFollowerPhaseLagMs).toBeNull();
    expect(sections.sectionCoherences?.[0]).toBeCloseTo(Math.SQRT1_2);
    expect(sections.sectionCoherences?.[1]).toBeCloseTo(0);
    expect(allToAll.leaderToFollowerPhaseLagMs).toBeNull();
    expect(allToAll.sectionCoherences).toBeNull();
  });

  it("initial state keeps the requested musician count", () => {
    const state = createInitialState({ ...defaultConfig, musicianCount: 11 });
    expect(state.oscillators).toHaveLength(11);
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

  it("rejects non-positive simulation time steps", () => {
    expect(() => simulateEnsemble(defaultConfig, 0.1, 0)).toThrow(RangeError);
    expect(() => simulateEnsemble(defaultConfig, 0.1, -0.01)).toThrow(RangeError);
  });

  it("rejects non-finite or negative simulation durations", () => {
    expect(() => simulateEnsemble(defaultConfig, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => simulateEnsemble(defaultConfig, -1)).toThrow(RangeError);
  });

  it("accepts model config values at the supported UI boundaries", () => {
    const minConfig: EnsembleConfig = {
      musicianCount: 2,
      tempoBpm: 40,
      tempoSpreadBpm: 0,
      couplingStrength: 0,
      latencySeconds: 0,
      jitterSeconds: 0,
      topology: "all-to-all",
      repertoireTexture: "pulse",
      clickTrackStrength: 0,
    };
    const maxConfig: EnsembleConfig = {
      musicianCount: 24,
      tempoBpm: 220,
      tempoSpreadBpm: 30,
      couplingStrength: 4,
      latencySeconds: 0.25,
      jitterSeconds: 0.08,
      topology: "click-track",
      repertoireTexture: "dense-rhythm",
      clickTrackStrength: 4,
    };

    expect(createInitialState(minConfig).oscillators).toHaveLength(2);
    expect(createInitialState(maxConfig).oscillators).toHaveLength(24);
    expect(() => simulateEnsemble(minConfig, 0.02)).not.toThrow();
    expect(() => simulateEnsemble(maxConfig, 0.02)).not.toThrow();
  });

  it.each([
    "all-to-all",
    "leader-follower",
    "sections",
    "click-track",
  ] as const)("simulates the expanded endpoint combination for %s topology", (topology) => {
    const result = simulateEnsemble({
      ...defaultConfig,
      musicianCount: 24,
      tempoBpm: 220,
      tempoSpreadBpm: 30,
      couplingStrength: 4,
      latencySeconds: 0.25,
      jitterSeconds: 0.08,
      clickTrackStrength: 4,
      topology,
    }, 0.3);

    expect(result.finalState.oscillators).toHaveLength(24);
    expect(result.finalMetrics.coherence).toBeGreaterThanOrEqual(0);
    expect(result.finalMetrics.coherence).toBeLessThanOrEqual(1);
  });

  it("rejects invalid model config boundaries before simulation", () => {
    const invalidConfigs: Partial<EnsembleConfig>[] = [
      { musicianCount: 1 },
      { musicianCount: 2.5 },
      { musicianCount: Number.NaN },
      { tempoBpm: 0 },
      { tempoBpm: Number.POSITIVE_INFINITY },
      { tempoSpreadBpm: -0.5 },
      { couplingStrength: -0.1 },
      { latencySeconds: -0.001 },
      { jitterSeconds: -0.001 },
      { clickTrackStrength: -0.1 },
      { topology: "mesh" as EnsembleConfig["topology"] },
      { repertoireTexture: "noise" as EnsembleConfig["repertoireTexture"] },
    ];

    for (const patch of invalidConfigs) {
      expect(() => createInitialState({ ...defaultConfig, ...patch })).toThrow(RangeError);
      expect(() => simulateEnsemble({ ...defaultConfig, ...patch }, 0.02)).toThrow(RangeError);
    }
  });

  it("rejects invalid configs across public model helpers", () => {
    const invalidConfig = { ...defaultConfig, tempoBpm: 0 };
    const validState = createInitialState(defaultConfig);
    const validEdges = createCouplingEdges(defaultConfig);

    expect(() => createCouplingEdges(invalidConfig)).toThrow(RangeError);
    expect(() => modelLatencyBudgetSeconds(invalidConfig)).toThrow(RangeError);
    expect(() => peerCouplingShare(invalidConfig)).toThrow(RangeError);
    expect(() => metricsFor(validState, invalidConfig)).toThrow(RangeError);
    expect(() => stepEnsemble(validState, invalidConfig, validEdges, [], 0.01)).toThrow(
      RangeError,
    );
  });

  it("rejects malformed delayed-coupling edge endpoints", () => {
    const state = createInitialState({ ...defaultConfig, musicianCount: 2 });
    const malformedEdges = [
      { from: -1, to: 0, strength: 1, delaySeconds: 0.01 },
      { from: 2, to: 0, strength: 1, delaySeconds: 0.01 },
      { from: 0, to: -1, strength: 1, delaySeconds: 0.01 },
      { from: 0, to: 2, strength: 1, delaySeconds: 0.01 },
    ];

    for (const edge of malformedEdges) {
      expect(() =>
        stepEnsemble(state, { ...defaultConfig, musicianCount: 2 }, [edge], [state], 0.01),
      ).toThrow(RangeError);
    }
  });

  it("uses the current source oscillator for intended early delayed-coupling startup", () => {
    const config: EnsembleConfig = {
      ...defaultConfig,
      musicianCount: 2,
      tempoSpreadBpm: 0,
      couplingStrength: 1,
      latencySeconds: 0.1,
      jitterSeconds: 0,
      clickTrackStrength: 0,
    };
    const state = {
      time: 0,
      oscillators: [
        { phase: 0, omega: 0 },
        { phase: Math.PI / 2, omega: 0 },
      ],
    };
    const edge = { from: 1, to: 0, strength: 1, delaySeconds: 0.1 };

    const nextFromEmptyHistory = stepEnsemble(state, config, [edge], [], 0.01);
    const nextFromBeforeZero = stepEnsemble(
      { ...state, time: 0.05 },
      config,
      [edge],
      [state],
      0.01,
    );

    expect(nextFromEmptyHistory.oscillators[0]?.phase).toBeGreaterThan(0);
    expect(nextFromBeforeZero.oscillators[0]?.phase).toBeGreaterThan(0);
  });

  it("selects the latest delayed state at or before the requested time", () => {
    const history = [0.1, 0.2, 0.2, 0.4].map((time, index) => ({
      time,
      oscillators: [{ phase: index + 1, omega: 0 }],
    }));
    const fallback = { time: 0.5, oscillators: [{ phase: 9, omega: 0 }] };

    expect(delayedOscillatorPhase(history, fallback, 0, 0.05)).toBe(9);
    expect(delayedOscillatorPhase(history, fallback, 0, 0.2)).toBe(3);
    expect(delayedOscillatorPhase(history, fallback, 0, 0.3)).toBe(3);
    expect(delayedOscillatorPhase(history, fallback, 0, 0.5)).toBe(4);
  });

  it("rejects mismatched delayed-coupling history instead of falling back to oscillator zero", () => {
    const config: EnsembleConfig = {
      ...defaultConfig,
      musicianCount: 2,
      tempoSpreadBpm: 0,
      couplingStrength: 1,
      latencySeconds: 0.05,
      jitterSeconds: 0,
      clickTrackStrength: 0,
    };
    const state = {
      time: 1,
      oscillators: [
        { phase: 0, omega: 0 },
        { phase: Math.PI / 2, omega: 0 },
      ],
    };
    const mismatchedHistory = [
      {
        time: 0.9,
        oscillators: [{ phase: 0, omega: 0 }],
      },
    ];

    expect(() =>
      stepEnsemble(
        state,
        config,
        [{ from: 1, to: 0, strength: 1, delaySeconds: 0.05 }],
        mismatchedHistory,
        0.01,
      ),
    ).toThrow(RangeError);
  });

  it("ends finite trials at their declared duration without an extra integration step", () => {
    const eightSeconds = simulateEnsemble(defaultConfig, 8, 0.01);
    const partialStep = simulateEnsemble(defaultConfig, 0.025, 0.01);

    expect(eightSeconds.finalState.time).toBe(8);
    expect(eightSeconds.samples.every((sample) => sample.state.time <= 8)).toBe(true);
    expect(partialStep.finalState.time).toBe(0.025);
  });
});
