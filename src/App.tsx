import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  type EnsembleConfig,
  type EnsembleMetrics,
  type EnsembleState,
  configsEqual,
  createCouplingEdges,
  createInitialState,
  metricsFor,
  retuneState,
  stepEnsemble,
} from "./simulation/ensemble";
import { lessonById, lessonPresets } from "./simulation/presets";
import { rehearsalSuggestions } from "./simulation/suggestions";
import { Controls } from "./components/Controls";
import { FormalModel } from "./components/FormalModel";
import { LessonPanel } from "./components/LessonPanel";
import { MetricsPanel } from "./components/MetricsPanel";
import { PhaseCircle } from "./components/PhaseCircle";
import { TheorySection } from "./components/TheorySection";
import { TimingPlot } from "./components/TimingPlot";
import { usePulseAudio } from "./components/usePulseAudio";

export type MetricPoint = {
  time: number;
  coherence: number;
  timingErrorMs: number;
};

const SIMULATION_SPEED = 0.55;

export function App(): ReactElement {
  const [lessonId, setLessonId] = useState("lock-in");
  const [config, setConfig] = useState<EnsembleConfig>(() => lessonById("lock-in").config);
  const [state, setState] = useState<EnsembleState>(() => createInitialState(config));
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<MetricPoint[]>([]);
  const historyRef = useRef<EnsembleState[]>([]);
  const previousPhasesRef = useRef<number[]>(state.oscillators.map((oscillator) => oscillator.phase));
  const { audioEnabled, setAudioEnabled, triggerPulse } = usePulseAudio();

  const selectedLesson = useMemo(() => lessonById(lessonId), [lessonId]);
  const isExploring = useMemo(
    () => !configsEqual(config, selectedLesson.config),
    [config, selectedLesson.config],
  );
  const edges = useMemo(() => createCouplingEdges(config), [config]);
  const metrics = useMemo(() => metricsFor(state, config), [state, config]);
  const suggestions = useMemo(
    () => rehearsalSuggestions(config, metrics),
    [config, metrics],
  );

  useEffect(() => {
    if (!running) {
      return;
    }

    let frameId = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const elapsedSeconds = Math.min((now - last) / 1000, 0.05) * SIMULATION_SPEED;
      last = now;

      setState((current) => {
        historyRef.current.push(current);
        if (historyRef.current.length > 240) {
          historyRef.current.shift();
        }

        const next = stepEnsemble(current, config, edges, historyRef.current, elapsedSeconds);
        playCrossingPulses(previousPhasesRef.current, next, triggerPulse);
        previousPhasesRef.current = next.oscillators.map((oscillator) => oscillator.phase);
        const nextMetrics = metricsFor(next, config);
        setHistory((points) =>
          [
            ...points,
            {
              time: next.time,
              coherence: nextMetrics.coherence,
              timingErrorMs: nextMetrics.timingErrorMs,
            },
          ].slice(-240),
        );
        return next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [config, edges, running, triggerPulse]);

  function reset(nextConfig = config): void {
    const nextState = createInitialState(nextConfig);
    historyRef.current = [];
    previousPhasesRef.current = nextState.oscillators.map((oscillator) => oscillator.phase);
    setState(nextState);
    setHistory([]);
  }

  function applyLesson(nextLessonId: string): void {
    const lesson = lessonById(nextLessonId);
    setLessonId(nextLessonId);
    setConfig(lesson.config);
    setRunning(false);
    reset(lesson.config);
  }

  function updateConfig(patch: Partial<EnsembleConfig>): void {
    const next = { ...config, ...patch };
    setConfig(next);
    retuneRunState(next);
  }

  function retuneRunState(nextConfig: EnsembleConfig): void {
    historyRef.current = historyRef.current.map((entry) => retuneState(entry, nextConfig));
    setState((current) => {
      const nextState = retuneState(current, nextConfig);
      previousPhasesRef.current = nextState.oscillators.map((oscillator) => oscillator.phase);
      return nextState;
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">HfMT teaching harness</p>
          <h1>Ensemble Coupling Lab</h1>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => setRunning((value) => !value)}>
            {running ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => reset()}>
            Reset
          </button>
          <label className="audio-toggle">
            <input
              checked={audioEnabled}
              onChange={(event) => setAudioEnabled(event.target.checked)}
              type="checkbox"
            />
            Audio
          </label>
        </div>
      </header>

      <section className="workspace">
        <LessonPanel
          activeLessonId={lessonId}
          isExploring={isExploring}
          lessons={lessonPresets}
          onSelectLesson={applyLesson}
        />

        <section className="simulation-surface" aria-label="Ensemble simulation">
          <PhaseCircle state={state} />
          <TimingPlot points={history} />
          <MetricsPanel config={config} metrics={metrics} suggestions={suggestions} />
        </section>

        <Controls config={config} onChange={updateConfig} />
      </section>

      <FormalModel />
      <TheorySection />
    </main>
  );
}

function playCrossingPulses(
  previousPhases: readonly number[],
  state: EnsembleState,
  triggerPulse: (index: number, intensity: number) => void,
): void {
  state.oscillators.forEach((oscillator, index) => {
    const previous = previousPhases[index] ?? oscillator.phase;
    if (oscillator.phase < previous) {
      const intensity = 0.35 + index / Math.max(state.oscillators.length * 2, 1);
      triggerPulse(index, intensity);
    }
  });
}
