import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { LessonWorkbenchController } from "../../src/app/workbench/LessonWorkbenchController";
import { curriculumRegistry } from "../../src/curriculum/catalog";
import type { CurriculumRegistry } from "../../src/curriculum/registry";
import { activeAttempt } from "../../src/learning/portfolio/aggregate";
import { attemptKey, portfolioStorageKey, type LearningPortfolioV2, type LessonAttemptV2 } from "../../src/learning/portfolio/schema";
import "../../src/styles/index.css";

// The failure exists only in this development fixture, never in product code.
const curriculum: CurriculumRegistry = {
  ...curriculumRegistry,
  evaluatorFor: (domainId, lessonId) => {
    const evaluate = curriculumRegistry.evaluatorFor(domainId, lessonId);
    return (factors) => {
      if (factors["bpm"] === 120) throw new Error("Injected lesson render failure");
      return evaluate(factors);
    };
  },
};

function loadPortfolio(): LearningPortfolioV2 {
  const stored = localStorage.getItem(portfolioStorageKey);
  if (stored === null) throw new Error("The recovery fixture needs a saved portfolio.");
  return JSON.parse(stored) as LearningPortfolioV2;
}

function Fixture() {
  const [portfolio, setPortfolio] = useState(loadPortfolio);
  const attempt = activeAttempt(curriculumRegistry, portfolio);
  function replaceAttempt(next: LessonAttemptV2): void {
    const changed = { ...portfolio, attempts: { ...portfolio.attempts, [attemptKey(next.labId, next.lessonId)]: next } };
    localStorage.setItem(portfolioStorageKey, JSON.stringify(changed));
    setPortfolio(changed);
  }
  return <LessonWorkbenchController curriculum={curriculum} lesson={curriculum.defaultLesson} attempt={attempt} onAttemptChange={replaceAttempt} onPersistenceMessage={() => {}} />;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element for the recovery fixture.");
createRoot(rootElement).render(<StrictMode><Fixture /></StrictMode>);
