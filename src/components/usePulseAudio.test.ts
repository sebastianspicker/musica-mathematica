import { describe, expect, it, vi } from "vitest";

type HookRuntime = {
  cleanup: (() => void) | undefined;
  render: () => ReturnType<typeof import("./usePulseAudio").usePulseAudio>;
};

const hookRuntime = vi.hoisted(() => {
  let hookIndex = 0;
  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  let cleanup: (() => void) | undefined;
  let effectRegistered = false;

  return {
    reset: () => {
      hookIndex = 0;
      states.length = 0;
      refs.length = 0;
      cleanup = undefined;
      effectRegistered = false;
    },
    beginRender: () => {
      hookIndex = 0;
    },
    get cleanup() {
      return cleanup;
    },
    useState: <T,>(initialValue: T) => {
      const index = hookIndex++;
      states[index] ??= initialValue;
      return [states[index] as T, (value: T) => {
        states[index] = value;
      }] as const;
    },
    useRef: <T,>(initialValue: T) => {
      const index = hookIndex++;
      refs[index] ??= { current: initialValue };
      return refs[index] as { current: T };
    },
    useCallback: <T,>(callback: T) => {
      hookIndex++;
      return callback;
    },
    useEffect: (effect: () => (() => void) | undefined) => {
      hookIndex++;
      if (!effectRegistered) {
        effectRegistered = true;
        cleanup = effect();
      }
    },
  };
});

vi.mock("react", () => hookRuntime);

import { usePulseAudio } from "./usePulseAudio";

function renderHook(): HookRuntime {
  hookRuntime.reset();
  return {
    get cleanup() {
      return hookRuntime.cleanup;
    },
    render: () => {
      hookRuntime.beginRender();
      return usePulseAudio();
    },
  };
}

class FakeAudioContext {
  state: AudioContextState = "running";
  readonly close = vi.fn(() => Promise.resolve());
  readonly createOscillator = vi.fn(() => {
    throw new Error("audio graph failure");
  });
}

describe("usePulseAudio", () => {
  it("closes a created context exactly once when unmounted", () => {
    const runtime = renderHook();
    const audio = runtime.render();
    const context = new FakeAudioContext();
    const AudioContextCtor = vi.fn(() => context);
    vi.stubGlobal("window", { AudioContext: AudioContextCtor });

    audio.setAudioEnabled(true);
    runtime.cleanup?.();
    runtime.cleanup?.();

    expect(AudioContextCtor).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("closes an existing context once when audio becomes unavailable", () => {
    const runtime = renderHook();
    const initialAudio = runtime.render();
    const context = new FakeAudioContext();
    vi.stubGlobal("window", { AudioContext: vi.fn(() => context) });

    initialAudio.setAudioEnabled(true);
    const enabledAudio = runtime.render();
    enabledAudio.triggerPulse(0, 1);
    runtime.cleanup?.();

    expect(context.close).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
