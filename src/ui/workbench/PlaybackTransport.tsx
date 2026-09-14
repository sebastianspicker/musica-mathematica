import type { ReactElement } from "react";
import { InterfaceIcon } from "../Icon";
import type { LessonWorkbenchRuntimeView } from "./types";

export type PlaybackTransportProps = Readonly<{
  duration: number;
  runtime: Pick<LessonWorkbenchRuntimeView, "audio" | "experimentActive" | "motionEnabled" | "togglePlayback" | "stepPlayback" | "resetPlayback" | "setMotionEnabled"> & Readonly<{ playhead: number; running: boolean }>;
}>;

export function PlaybackTransport({ duration, runtime }: PlaybackTransportProps): ReactElement {
  const { audio } = runtime;
  return <>
    <div className="mm-transport" aria-label="Experiment transport">
      <button disabled={!runtime.experimentActive || !runtime.motionEnabled} type="button" onClick={runtime.togglePlayback}>
        <InterfaceIcon name={runtime.running ? "pause" : "play"} />
        <span>{runtime.running ? "Pause" : "Play"}</span>
      </button>
      <button disabled={!runtime.experimentActive || runtime.running} type="button" onClick={runtime.stepPlayback}>
        <InterfaceIcon name="step" />
        <span>Step 0.5 s</span>
      </button>
      <button type="button" onClick={runtime.resetPlayback}>
        <InterfaceIcon name="reset" />
        <span>Reset view</span>
      </button>
      <div className="mm-transport-time"><span>Protocol</span><strong>{runtime.playhead.toFixed(1)} / {duration.toFixed(1)} s</strong></div>
      <label className="mm-compact-toggle"><input checked={runtime.motionEnabled} type="checkbox" onChange={(event) => { runtime.setMotionEnabled(event.currentTarget.checked); if (!event.currentTarget.checked) runtime.resetPlayback(); }} />Motion</label>
      <label className="mm-compact-toggle"><input checked={audio.audioEnabled} type="checkbox" onChange={(event) => {
        audio.setAudioEnabled(event.currentTarget.checked);
      }} />Audio</label>
      {audio.audioEnabled ? <label className="mm-volume-control"><span>Volume</span><input aria-label="Preview volume" disabled={!audio.audioEnabled} min="0" max="100" type="range" value={Math.round(audio.audioVolume * 100)} onChange={(event) => {
        audio.setAudioVolume(event.currentTarget.valueAsNumber / 100);
      }} /></label> : null}
    </div>
    {audio.audioUnavailableReason ? <p className="mm-audio-message" role="status">{audio.audioUnavailableReason}</p> : null}
  </>;
}
