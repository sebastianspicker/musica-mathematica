import { useSyncExternalStore, type ReactElement } from "react";
import { PlaybackTransport } from "../../ui/workbench/PlaybackTransport";
import type { LessonControllerRuntime } from "./useLessonController";

export function PlaybackController({ duration, runtime }: Readonly<{
  duration: number;
  runtime: LessonControllerRuntime;
}>): ReactElement {
  const snapshot = useSyncExternalStore(runtime.playback.subscribe, runtime.playback.getSnapshot, runtime.playback.getSnapshot);
  return <PlaybackTransport duration={duration} runtime={{ ...runtime, ...snapshot }} />;
}
