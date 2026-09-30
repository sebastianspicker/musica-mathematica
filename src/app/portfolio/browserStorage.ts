import type { StoragePort } from "../../learning/portfolio/schema";

export function browserStorage(): StoragePort | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
