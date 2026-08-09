import { afterEach, describe, expect, it, vi } from "vitest";

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
  readonly currentTime = 3;
  readonly destination = {} as AudioDestinationNode;
  readonly close = vi.fn(() => Promise.resolve());
  readonly resume = vi.fn(() => Promise.resolve());
  readonly gain = {
    gain: {
      exponentialRampToValueAtTime: vi.fn(),
      setValueAtTime: vi.fn(),
    },
    connect: vi.fn(() => this.destination),
  };
  readonly oscillator = {
    connect: vi.fn(() => this.gain),
    frequency: { value: 0 },
    start: vi.fn(),
    stop: vi.fn(),
    type: "square" as OscillatorType,
  };
  readonly createGain = vi.fn(() => this.gain);
  readonly createOscillator = vi.fn(() => this.oscillator);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function installAudioContext(context: FakeAudioContext): ReturnType<typeof vi.fn> {
  const AudioContextCtor = vi.fn(() => context);
  vi.stubGlobal("window", { AudioContext: AudioContextCtor });
  return AudioContextCtor;
}

function enableAudio(runtime: HookRuntime): ReturnType<typeof usePulseAudio> {
  const audio = runtime.render();
  audio.setAudioEnabled(true);
  return runtime.render();
}

describe("usePulseAudio", () => {
  it("closes a created context exactly once when unmounted", () => {
    const runtime = renderHook();
    const context = new FakeAudioContext();
    const AudioContextCtor = installAudioContext(context);

    const audio = runtime.render();
    audio.setAudioEnabled(true);
    runtime.cleanup?.();
    runtime.cleanup?.();

    expect(AudioContextCtor).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled", () => {
    const runtime = renderHook();
    const context = new FakeAudioContext();
    const AudioContextCtor = installAudioContext(context);

    runtime.render().triggerPulse(2, 1);

    expect(AudioContextCtor).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it("reports unsupported, construction-failed, and closed contexts without enabling audio", () => {
    const runtime = renderHook();
    vi.stubGlobal("window", {});

    runtime.render().setAudioEnabled(true);
    const unsupportedAudio = runtime.render();

    expect(unsupportedAudio).toMatchObject({
      audioEnabled: false,
      audioUnavailableReason: "Audio unavailable in this browser.",
    });

    const constructionRuntime = renderHook();
    vi.stubGlobal("window", {
      AudioContext: vi.fn(() => {
        throw new Error("construction failed");
      }),
    });
    constructionRuntime.render().setAudioEnabled(true);

    expect(constructionRuntime.render()).toMatchObject({
      audioEnabled: false,
      audioUnavailableReason: "Audio could not start.",
    });

    const closedRuntime = renderHook();
    const context = new FakeAudioContext();
    context.state = "closed";
    installAudioContext(context);

    closedRuntime.render().setAudioEnabled(true);
    const closedAudio = closedRuntime.render();

    expect(closedAudio).toMatchObject({
      audioEnabled: false,
      audioUnavailableReason: "Audio could not start.",
    });
    expect(context.close).not.toHaveBeenCalled();
  });

  it("clamps volume and intensity while scheduling the expected pulse envelope", () => {
    const runtime = renderHook();
    const context = new FakeAudioContext();
    installAudioContext(context);

    const initialAudio = runtime.render();
    initialAudio.setAudioVolume(2);
    expect(runtime.render().audioVolume).toBe(1);
    initialAudio.setAudioVolume(-3);
    expect(runtime.render().audioVolume).toBe(0);
    runtime.render().setAudioVolume(2);
    const enabledAudio = enableAudio(runtime);
    enabledAudio.triggerPulse(3, 2);

    expect(context.oscillator.type).toBe("sine");
    expect(context.oscillator.frequency.value).toBe(331);
    expect(context.gain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 3);
    expect(context.gain.gain.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(1, 0.025, 3.004);
    expect(context.gain.gain.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(2, 0.0001, 3.08);
    expect(context.oscillator.start).toHaveBeenCalledWith(3);
    expect(context.oscillator.stop).toHaveBeenCalledWith(3.09);
  });

  it("marks audio unavailable after a suspended-context resume rejection", async () => {
    const runtime = renderHook();
    const context = new FakeAudioContext();
    context.state = "suspended";
    context.resume.mockRejectedValue(new Error("resume failed"));
    installAudioContext(context);

    enableAudio(runtime).triggerPulse(0, 1);
    await vi.waitFor(() => expect(runtime.render().audioUnavailableReason).toBe("Audio could not start."));

    expect(runtime.render().audioEnabled).toBe(false);
    expect(context.close).toHaveBeenCalledOnce();
  });

  it("closes an existing context once when pulse graph creation fails", () => {
    const runtime = renderHook();
    const context = new FakeAudioContext();
    context.createOscillator.mockImplementation(() => {
      throw new Error("audio graph failure");
    });
    installAudioContext(context);

    enableAudio(runtime).triggerPulse(0, 1);
    runtime.cleanup?.();

    expect(context.close).toHaveBeenCalledTimes(1);
    expect(runtime.render()).toMatchObject({
      audioEnabled: false,
      audioUnavailableReason: "Audio could not start.",
    });
  });
});
