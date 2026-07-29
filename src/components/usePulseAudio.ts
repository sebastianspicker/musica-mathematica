import { useCallback, useEffect, useRef, useState } from "react";

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

export function usePulseAudio(): PulseAudio {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioVolume, setAudioVolumeState] = useState(DEFAULT_AUDIO_VOLUME);
  const [audioUnavailableReason, setAudioUnavailableReason] = useState<string | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  const closeContext = useCallback((): void => {
    const context = contextRef.current;
    contextRef.current = null;

    if (!context || context.state === "closed") {
      return;
    }

    try {
      void context.close().catch(() => undefined);
    } catch {
      // Closing is best-effort during error handling and unmount.
    }
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
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) {
      markAudioUnavailable("Audio unavailable in this browser.");
      return null;
    }

    try {
      const context = contextRef.current ?? new AudioContextCtor();
      if (context.state === "closed") {
        markAudioUnavailable("Audio could not start.");
        return null;
      }

      contextRef.current = context;
      return context;
    } catch {
      markAudioUnavailable("Audio could not start.");
      return null;
    }
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
    if (!Number.isFinite(volume)) {
      return;
    }
    setAudioVolumeState(Math.min(1, Math.max(0, volume)));
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

      if (context.state === "suspended") {
        void context.resume().catch(() => {
          markAudioUnavailable("Audio could not start.");
        });
      }

      try {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.value = 220 + index * 37;
        gain.gain.setValueAtTime(0.0001, now);
        const boundedIntensity = Math.min(1, Math.max(0, intensity));
        const peakGain = Math.max(0.0001, MAX_PULSE_GAIN * audioVolume * boundedIntensity);
        gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
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
