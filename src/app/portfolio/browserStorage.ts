import type { StoragePort } from "../../learning/portfolio/ports";

export function browserStorage(): StoragePort | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
