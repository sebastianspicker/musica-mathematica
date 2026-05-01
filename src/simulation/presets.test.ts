import { describe, expect, it } from "vitest";
import { lessonById, lessonPresets } from "./presets";

describe("lesson presets", () => {
  it("uses unique lesson IDs", () => {
    const ids = lessonPresets.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("appends transfer lessons after the three experience lessons", () => {
    expect(lessonPresets.map((lesson) => lesson.id)).toEqual([
      "lock-in",
      "latency",
      "click",
      "low-latency-route",
      "diagnose-instability",
      "click-or-peer-coupling",
      "compose-with-latency",
    ]);
  });

  it("selects transfer lessons by ID", () => {
    expect(lessonById("low-latency-route").title).toBe("4. Low-Latency Route Check");
    expect(lessonById("compose-with-latency").title).toBe("7. Compose With Latency");
  });

  it("starts the first experience with slow observable lock-in", () => {
    const lesson = lessonById("lock-in");
    expect(lesson.config.couplingStrength).toBeLessThan(0.25);
    expect(lesson.config.tempoSpreadBpm).toBeGreaterThanOrEqual(12);
  });

  it("encodes the illustrative low-latency feasibility scenario", () => {
    const lesson = lessonById("low-latency-route");
    expect(lesson.config.latencySeconds).toBeCloseTo(0.0075);
    expect(lesson.config.repertoireTexture).toBe("dense-rhythm");
    expect(lesson.prompts.join(" ")).toContain("physically plausible");
    expect(lesson.prompts.join(" ")).not.toContain("measured");
  });

  it("encodes the instability diagnosis scenario", () => {
    const lesson = lessonById("diagnose-instability");
    expect(lesson.config.couplingStrength).toBeLessThan(0.8);
    expect(lesson.config.tempoSpreadBpm).toBeGreaterThan(12);
    expect(lesson.config.jitterSeconds).toBeGreaterThan(0.02);
  });

  it("encodes the click-track peer-coupling scenario", () => {
    const lesson = lessonById("click-or-peer-coupling");
    expect(lesson.config.topology).toBe("click-track");
    expect(lesson.config.clickTrackStrength).toBeGreaterThan(lesson.config.couplingStrength);
  });

  it("encodes the latency-as-material composition scenario", () => {
    const lesson = lessonById("compose-with-latency");
    expect(lesson.config.tempoBpm).toBeLessThan(90);
    expect(lesson.config.latencySeconds).toBeGreaterThan(0.1);
    expect(lesson.config.repertoireTexture).toBe("call-response");
  });
});
