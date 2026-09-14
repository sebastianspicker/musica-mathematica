export type PlaybackSnapshot = Readonly<{ playhead: number; running: boolean }>;
export type PlaybackClock = Readonly<{
  now: () => number;
  requestFrame: (callback: (now: number) => void) => number;
  cancelFrame: (frame: number) => void;
}>;
type Pulse = (index: number, intensity: number) => void;
type Update<T> = T | ((previous: T) => T);

/** The frame clock advances playback; only the transport subscribes to its display. */
export function createPlaybackStore(duration: number, clock: PlaybackClock) {
  let playhead = 0;
  let running = false;
  let previousBeat = -1;
  let previousTime = 0;
  let publishedAt = 0;
  let frame: number | null = null;
  let triggerPulse: Pulse = () => undefined;
  let snapshot: PlaybackSnapshot = { playhead, running };
  const listeners = new Set<() => void>();

  function publish(): void {
    if (snapshot.playhead === playhead && snapshot.running === running) return;
    snapshot = { playhead, running };
    for (const listener of listeners) listener();
  }

  function tick(now: number): void {
    frame = null;
    if (!running) return;
    // Preserve the elapsed cap and beat calculation, including the final beat.
    const next = playhead + Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;
    const beat = Math.floor(next);
    if (beat !== previousBeat) {
      previousBeat = beat;
      triggerPulse(beat % 4, beat % 4 === 0 ? 1 : 0.65);
    }
    playhead = Math.min(duration, next);
    if (next >= duration) running = false;
    if (!running || now - publishedAt >= 100) {
      publishedAt = now;
      publish();
    }
    if (running) frame = clock.requestFrame(tick);
  }

  function setRunning(update: Update<boolean>): void {
    const next = typeof update === "function" ? update(running) : update;
    if (next === running) return;
    running = next;
    if (running) {
      previousTime = clock.now();
      publishedAt = previousTime;
      frame = clock.requestFrame(tick);
    } else if (frame !== null) {
      clock.cancelFrame(frame);
      frame = null;
    }
    publish();
  }

  function setPlayhead(update: Update<number>): void {
    playhead = typeof update === "function" ? update(playhead) : update;
    publish();
  }

  return {
    getSnapshot: (): PlaybackSnapshot => snapshot,
    getPlayhead: (): number => playhead,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setPulse: (pulse: Pulse): void => { triggerPulse = pulse; },
    setPlayhead,
    setRunning,
    stop: (): void => { setRunning(false); },
  };
}

export type PlaybackStore = ReturnType<typeof createPlaybackStore>;
