import { describe, expect, it, vi } from "vitest";
import { createPlaybackStore } from "./playbackStore";

function fixture(duration = 8) {
  let now = 0;
  let nextId = 0;
  const frames = new Map<number, (time: number) => void>();
  const store = createPlaybackStore(duration, {
    now: () => now,
    requestFrame: (callback) => { frames.set(++nextId, callback); return nextId; },
    cancelFrame: (id) => { frames.delete(id); },
  });
  const pulse = vi.fn();
  const listener = vi.fn();
  store.setPulse(pulse);
  store.subscribe(listener);
  function advance(milliseconds: number) {
    now += milliseconds;
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(now);
  }
  return { store, pulse, listener, advance, frames };
}

describe("playback transport store", () => {
  it("publishes running immediately and the playhead at most once per 100 ms", () => {
    const { store, listener, advance } = fixture();
    const initial = store.getSnapshot();
    store.setRunning(true);
    expect(store.getSnapshot()).toEqual({ playhead: 0, running: true });
    expect(store.getSnapshot()).not.toBe(initial);
    listener.mockClear();
    const snapshot = store.getSnapshot();
    for (let i = 0; i < 9; i++) advance(10);
    expect(store.getPlayhead()).toBeCloseTo(0.09);
    expect(store.getSnapshot()).toBe(snapshot);
    expect(listener).not.toHaveBeenCalled();
    advance(10);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().playhead).toBeCloseTo(0.1);
    for (let i = 0; i < 90; i++) advance(10);
    expect(listener).toHaveBeenCalledTimes(10);
  });

  it("caps long frame gaps at 0.1 seconds and emits only the current integer beat", () => {
    const { store, pulse, advance } = fixture();
    store.setRunning(true);
    advance(2000);
    expect(store.getPlayhead()).toBe(0.1);
    expect(pulse.mock.calls).toEqual([[0, 1]]);
    store.setPlayhead(0.95);
    advance(100);
    expect(pulse.mock.calls).toEqual([[0, 1], [1, 0.65]]);
    store.setPlayhead(3.95);
    advance(100);
    expect(pulse.mock.calls).toEqual([[0, 1], [1, 0.65], [0, 1]]);
  });

  it("publishes pause, step and reset immediately without scheduling pulses", () => {
    const { store, pulse, advance, frames } = fixture();
    store.setRunning(true);
    advance(25);
    store.stop();
    expect(store.getSnapshot()).toEqual({ playhead: 0.025, running: false });
    expect(frames.size).toBe(0);
    store.setPlayhead((value) => Math.min(8, value + 0.5));
    expect(store.getSnapshot().playhead).toBe(0.525);
    store.setPlayhead(0);
    expect(store.getSnapshot().playhead).toBe(0);
    expect(pulse).toHaveBeenCalledTimes(1);
    // Reset has never reset the previous beat; do not replay beat zero twice.
    store.setRunning(true);
    advance(25);
    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it("publishes completion immediately, clamps to duration and stops requesting frames", () => {
    const { store, pulse, advance, frames } = fixture(1);
    store.setPlayhead(0.99);
    store.setRunning(true);
    advance(20);
    expect(store.getSnapshot()).toEqual({ playhead: 1, running: false });
    expect(pulse.mock.calls).toEqual([[1, 0.65]]);
    expect(frames.size).toBe(0);
  });

  it("cleans up and resumes with one frame subscription and the latest pulse callback", () => {
    const { store, pulse, advance, frames } = fixture();
    store.setRunning(true);
    store.setRunning(true);
    expect(frames.size).toBe(1);
    store.stop();
    store.stop();
    expect(frames.size).toBe(0);
    advance(5000);
    const replacement = vi.fn();
    store.setPulse(replacement);
    store.setRunning(true);
    advance(10);
    expect(store.getPlayhead()).toBe(0.01);
    expect(pulse).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
    const unsubscribed = vi.fn();
    const unsubscribe = store.subscribe(unsubscribed);
    unsubscribe();
    store.stop();
    expect(unsubscribed).not.toHaveBeenCalled();
  });
});
