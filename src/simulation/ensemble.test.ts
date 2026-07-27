import { describe, expect, it } from "vitest";
import {
  type EnsembleConfig,
  type FixedStepSimulation,
  advanceFixedStepSimulation,
  configsEqual,
  createCouplingEdges,
  createInitialState,
  metricsFor,
  modelLatencyBudgetRatio,
  modelLatencyBudgetSeconds,
  modelLatencyBudgetStatus,
  peerCouplingShare,
  retuneState,
  simulateEnsemble,
  stepEnsemble,
} from "./ensemble";
import { defaultConfig } from "./presets";

function bpmToRadPerSecond(tempoBpm: number): number {
  return (tempoBpm / 60) * Math.PI * 2;
}

function run(config: Partial<EnsembleConfig>, seconds = 18): number {
  return simulateEnsemble({ ...defaultConfig, ...config }, seconds).finalMetrics.coherence;
}

function omegaSpan(config: EnsembleConfig): number {
  const state = createInitialState(config);
  const omegas = state.oscillators.map((oscillator) => oscillator.omega);
  return Math.max(...omegas) - Math.min(...omegas);
}

function advanceAcrossFrameChunks(
  config: EnsembleConfig,
  frameChunksSeconds: readonly number[],
): FixedStepSimulation {
  const initialSimulation: FixedStepSimulation = {
    state: createInitialState(config),
    history: [],
    accumulatorSeconds: 0,
  };

  return frameChunksSeconds.reduce(
    (simulation, elapsedSeconds) =>
      advanceFixedStepSimulation(simulation, config, elapsedSeconds),
    initialSimulation,
  );
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

  it("produces the same golden trace regardless of render-frame chunking", () => {
    const config: EnsembleConfig = {
      ...defaultConfig,
      tempoBpm: 118,
      tempoSpreadBpm: 9,
      couplingStrength: 1.25,
      latencySeconds: 0.04,
      jitterSeconds: 0.012,
      topology: "click-track",
      clickTrackStrength: 1.6,
    };
    const oneFrame = advanceAcrossFrameChunks(config, [0.1]);
    const unevenFrames = advanceAcrossFrameChunks(config, [0.017, 0.041, 0.009, 0.033]);

    const trace = (simulation: typeof oneFrame) => ({
      time: simulation.state.time,
      accumulatorSeconds: simulation.accumulatorSeconds,
      phases: simulation.state.oscillators.map((oscillator) => oscillator.phase),
      historyTimes: simulation.history.map((entry) => entry.time),
    });

    expect(trace(unevenFrames)).toEqual(trace(oneFrame));
    expect(trace(oneFrame)).toEqual({
      time: 0.09999999999999999,
      accumulatorSeconds: 0,
      phases: [
        1.503128093205347,
        1.7407022019563638,
        2.2622870908572823,
        3.7279854204281806,
        4.73353141224523,
        4.950090318592354,
        6.011571838644364,
        1.0058252620982182,
      ],
      historyTimes: [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.060000000000000005, 0.07, 0.08, 0.09],
    });
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

  it("accepts model config values at the supported UI boundaries", () => {
    const minConfig: EnsembleConfig = {
      musicianCount: 2,
      tempoBpm: 50,
      tempoSpreadBpm: 0,
      couplingStrength: 0,
      latencySeconds: 0,
      jitterSeconds: 0,
      topology: "all-to-all",
      repertoireTexture: "pulse",
      clickTrackStrength: 0,
    };
    const maxConfig: EnsembleConfig = {
      musicianCount: 16,
      tempoBpm: 180,
      tempoSpreadBpm: 24,
      couplingStrength: 3,
      latencySeconds: 0.18,
      jitterSeconds: 0.06,
      topology: "click-track",
      repertoireTexture: "dense-rhythm",
      clickTrackStrength: 3,
    };

    expect(createInitialState(minConfig).oscillators).toHaveLength(2);
    expect(createInitialState(maxConfig).oscillators).toHaveLength(16);
    expect(() => simulateEnsemble(minConfig, 0.02)).not.toThrow();
    expect(() => simulateEnsemble(maxConfig, 0.02)).not.toThrow();
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
    const metrics = { modelLatencyBudgetSeconds: 1 };

    expect(() => createCouplingEdges(invalidConfig)).toThrow(RangeError);
    expect(() => retuneState(validState, invalidConfig)).toThrow(RangeError);
    expect(() => modelLatencyBudgetSeconds(invalidConfig)).toThrow(RangeError);
    expect(() => modelLatencyBudgetRatio(invalidConfig, metrics)).toThrow(RangeError);
    expect(() => modelLatencyBudgetStatus(invalidConfig, metrics)).toThrow(RangeError);
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
