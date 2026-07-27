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

export function InterfaceIcon({ name }: Readonly<{ name: InterfaceIconName }>): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="mm-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d={iconPath(name)} />
    </svg>
  );
}

function iconPath(name: InterfaceIconName): string {
  switch (name) {
    case "boundary":
      return "M3 12c2.2-5.3 4.4-5.3 6.6 0s4.4 5.3 6.6 0 3.6-4.1 4.8-2.4";
    case "check":
      return "m5 12.5 4.2 4.2L19 7";
    case "chevron-down":
      return "m6.5 9 5.5 5.5L17.5 9";
    case "close":
      return "m6.5 6.5 11 11m0-11-11 11";
    case "export":
      return "M12 3v12m0-12 4 4m-4-4L8 7M5 13v6h14v-6";
    case "function":
      return "M15.5 4.5c-4.5-1.5-5 3-5.8 7.5S8.3 20.5 4 19m2-7h9m1.5 1.5 4 4m0-4-4 4";
    case "menu":
      return "M4 7h16M4 12h16M4 17h16";
    case "pause":
      return "M9 6v12m6-12v12";
    case "play":
      return "m8 5 10 7-10 7Z";
    case "present":
      return "M4 5h16v11H4Zm4 15 4-4 4 4";
    case "reset":
      return "M5.1 9A7.5 7.5 0 1 1 5 15m.1-6V4m0 5h5";
    case "source":
      return "M6 4h12v16H6Zm3 4h6m-6 4h6m-6 4h4";
    case "step":
      return "M6 5v14l9-7Zm11 0v14";
    case "trash":
      return "M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5";
    case "warning":
      return "M12 4 3.5 20h17ZM12 9v5m0 3v.2";
  }
}
