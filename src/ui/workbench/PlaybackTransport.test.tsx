import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlaybackTransport, type PlaybackTransportProps } from "./PlaybackTransport";

function runtime(audioEnabled: boolean): PlaybackTransportProps["runtime"] {
  return {
    audio: {
      audioEnabled,
      audioVolume: 0.35,
      audioUnavailableReason: null,
      setAudioEnabled: () => undefined,
      setAudioVolume: () => undefined,
    },
    experimentActive: true,
    motionEnabled: true,
    running: false,
    playhead: 0,
    togglePlayback: () => undefined,
    stepPlayback: () => undefined,
    resetPlayback: () => undefined,
    setMotionEnabled: () => undefined,
  };
}

describe("playback transport audio controls", () => {
  it("keeps audio opt-in available without an unusable volume control", () => {
    const markup = renderToStaticMarkup(<PlaybackTransport duration={8} runtime={runtime(false)} />);
    expect(markup).toContain("Audio</label>");
    expect(markup).toContain("Step 0.5 s");
    expect(markup).not.toContain('aria-label="Preview volume"');
  });

  it("reveals the current volume once audio is enabled", () => {
    const markup = renderToStaticMarkup(<PlaybackTransport duration={8} runtime={runtime(true)} />);
    expect(markup).toContain('aria-label="Preview volume"');
    expect(markup).toContain('value="35"');
  });
});
