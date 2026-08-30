import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

type PulseAudio = {
  audioEnabled: boolean;
  audioVolume: number;
  audioUnavailableReason: string | null;
  setAudioEnabled: (enabled: boolean) => void;
  setAudioVolume: (volume: number) => void;
  triggerPulse: (index: number, intensity: number) => void;
};

const DEFAULT_AUDIO_VOLUME = 0.35;
const MAX_PULSE_GAIN = 0.025;

type AudioContextResult = Readonly<{
  context: AudioContext | null;
  unavailableReason: string | null;
}>;

export function usePulseAudio(): PulseAudio {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioVolume, setAudioVolumeState] = useState(DEFAULT_AUDIO_VOLUME);
  const [audioUnavailableReason, setAudioUnavailableReason] = useState<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  const closeContext = useCallback((): void => {
    closeOwnedContext(contextRef);
  }, []);

  const markAudioUnavailable = useCallback((reason: string): void => {
    closeContext();
    setAudioEnabled(false);
    setAudioUnavailableReason(reason);
  }, [closeContext]);

  useEffect(() => {
    return closeContext;
  }, [closeContext]);

  const getOrCreateContext = useCallback((): AudioContext | null => {
    const { context, unavailableReason } = getOrCreateAudioContext(contextRef);
    if (unavailableReason) markAudioUnavailable(unavailableReason);
    return context;
  }, [markAudioUnavailable]);

  const setAudioEnabledSafely = useCallback(
    (enabled: boolean): void => {
      if (!enabled) {
        setAudioEnabled(false);
        setAudioUnavailableReason(null);
        return;
      }

      const context = getOrCreateContext();
      if (!context) {
        return;
      }

      setAudioUnavailableReason(null);
      setAudioEnabled(true);
    },
    [getOrCreateContext],
  );

  const setAudioVolume = useCallback((volume: number): void => {
    if (Number.isFinite(volume)) setAudioVolumeState(clampUnitInterval(volume));
  }, []);

  const triggerPulse = useCallback(
    (index: number, intensity: number): void => {
      if (!audioEnabled) {
        return;
      }

      const context = getOrCreateContext();
      if (!context) {
        return;
      }

      try {
        resumeAudioContext(context, markAudioUnavailable);
        schedulePulse(context, { audioVolume, index, intensity });
      } catch {
        markAudioUnavailable("Audio could not start.");
      }
    },
    [audioEnabled, audioVolume, getOrCreateContext, markAudioUnavailable],
  );

  return {
    audioEnabled,
    audioVolume,
    audioUnavailableReason,
    setAudioEnabled: setAudioEnabledSafely,
    setAudioVolume,
    triggerPulse,
  };
}

function closeOwnedContext(contextRef: MutableRefObject<AudioContext | null>): void {
  const context = contextRef.current;
  contextRef.current = null;
  if (!context || context.state === "closed") return;
  try {
    void context.close().catch(() => undefined);
  } catch {
    // Closing is best-effort during error handling and unmount.
  }
}

function getOrCreateAudioContext(contextRef: MutableRefObject<AudioContext | null>): AudioContextResult {
  if (!window.AudioContext) {
    return { context: null, unavailableReason: "Audio unavailable in this browser." };
  }
  try {
    const context = contextRef.current ?? new window.AudioContext();
    if (context.state === "closed") {
      return { context: null, unavailableReason: "Audio could not start." };
    }
    contextRef.current = context;
    return { context, unavailableReason: null };
  } catch {
    return { context: null, unavailableReason: "Audio could not start." };
  }
}

function resumeAudioContext(context: AudioContext, markAudioUnavailable: (reason: string) => void): void {
  if (context.state !== "suspended") return;
  void context.resume().catch(() => {
    markAudioUnavailable("Audio could not start.");
  });
}

function schedulePulse(context: AudioContext, request: Readonly<{
  audioVolume: number;
  index: number;
  intensity: number;
}>): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.value = 220 + request.index * 37;
  gain.gain.setValueAtTime(0.0001, now);
  const peakGain = Math.max(0.0001, MAX_PULSE_GAIN * request.audioVolume * clampUnitInterval(request.intensity));
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.09);
}

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value));
}
