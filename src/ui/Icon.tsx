import type { ReactElement } from "react";

export type InterfaceIconName =
  | "boundary"
  | "check"
  | "chevron-down"
  | "close"
  | "export"
  | "function"
  | "menu"
  | "pause"
  | "play"
  | "present"
  | "reset"
  | "source"
  | "step"
  | "trash"
  | "warning";

const iconPaths = new Map<InterfaceIconName, string>([
  ["boundary", "M3 12c2.2-5.3 4.4-5.3 6.6 0s4.4 5.3 6.6 0 3.6-4.1 4.8-2.4"],
  ["check", "m5 12.5 4.2 4.2L19 7"],
  ["chevron-down", "m6.5 9 5.5 5.5L17.5 9"],
  ["close", "m6.5 6.5 11 11m0-11-11 11"],
  ["export", "M12 3v12m0-12 4 4m-4-4L8 7M5 13v6h14v-6"],
  ["function", "M15.5 4.5c-4.5-1.5-5 3-5.8 7.5S8.3 20.5 4 19m2-7h9m1.5 1.5 4 4m0-4-4 4"],
  ["menu", "M4 7h16M4 12h16M4 17h16"],
  ["pause", "M9 6v12m6-12v12"],
  ["play", "m8 5 10 7-10 7Z"],
  ["present", "M4 5h16v11H4Zm4 15 4-4 4 4"],
  ["reset", "M5.1 9A7.5 7.5 0 1 1 5 15m.1-6V4m0 5h5"],
  ["source", "M6 4h12v16H6Zm3 4h6m-6 4h6m-6 4h4"],
  ["step", "M6 5v14l9-7Zm11 0v14"],
  ["trash", "M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5"],
  ["warning", "M12 4 3.5 20h17ZM12 9v5m0 3v.2"],
]);

export function InterfaceIcon({ name }: Readonly<{ name: InterfaceIconName }>): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="mm-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d={iconPaths.get(name)} />
    </svg>
  );
}
