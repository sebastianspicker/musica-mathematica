import type { RepertoireTexture, Topology } from "./ensemble";

export type ControlOption<T extends string> = {
  value: T;
  label: string;
};

export const topologyOptions: readonly ControlOption<Topology>[] = [
  { value: "all-to-all", label: "Everyone" },
  { value: "leader-follower", label: "Leader" },
  { value: "sections", label: "Sections" },
  { value: "click-track", label: "Click" },
] as const;

export const textureOptions: readonly ControlOption<RepertoireTexture>[] = [
  { value: "pulse", label: "Pulse" },
  { value: "drone", label: "Drone" },
  { value: "call-response", label: "Call" },
  { value: "rubato", label: "Rubato" },
  { value: "dense-rhythm", label: "Dense" },
] as const;
