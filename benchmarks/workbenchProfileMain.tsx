import { Profiler, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createDemoPortfolio } from "../src/app/demo/demoPortfolio";
import { LessonWorkbenchController } from "../src/app/workbench/LessonWorkbenchController";
import { curriculumRegistry } from "../src/curriculum/catalog";
import { activeAttempt } from "../src/learning/portfolio/aggregate";
import type { LessonAttemptV2 } from "../src/learning/portfolio/schema";
import "../src/styles/index.css";

// `workbench.mjs` installs `window.__profile` and instruments ResultVisual to count geometry builds.
type RenderProfile = { durations: number[]; geometry: number };
declare global {
  interface Window { __profile?: RenderProfile | null }
}

function Fixture() {
  const [attempt, setAttempt] = useState<LessonAttemptV2>(() => ({
    ...activeAttempt(curriculumRegistry, createDemoPortfolio(curriculumRegistry)),
    stage: "experiment",
  }));
  return <LessonWorkbenchController curriculum={curriculumRegistry} lesson={curriculumRegistry.defaultLesson} attempt={attempt} onAttemptChange={setAttempt} onPersistenceMessage={() => {}} />;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element for the workbench profile.");
createRoot(rootElement).render(
  <StrictMode>
    <Profiler id="workbench" onRender={(_id, phase, actualDuration) => {
      if (window.__profile && phase !== "mount") window.__profile.durations.push(actualDuration);
    }}>
      <Fixture />
    </Profiler>
  </StrictMode>,
);
