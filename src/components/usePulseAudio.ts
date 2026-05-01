import { useCallback, useRef, useState } from "react";

type PulseAudio = {
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  triggerPulse: (index: number, intensity: number) => void;
};

export function usePulseAudio(): PulseAudio {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

  const triggerPulse = useCallback(
    (index: number, intensity: number): void => {
      if (!audioEnabled) {
        return;
      }

      const AudioContextCtor = window.AudioContext;
      const context = contextRef.current ?? new AudioContextCtor();
      contextRef.current = context;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = 220 + index * 37;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.04 * intensity, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.09);
    },
    [audioEnabled],
  );

  return {
    audioEnabled,
    setAudioEnabled,
    triggerPulse,
  };
}
