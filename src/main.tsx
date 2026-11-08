import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { RootErrorBoundary } from "./app/RootErrorBoundary";
import { browserStorage } from "./app/portfolio/browserStorage";
import { createDemoStorage } from "./app/demo/demoStorage";
import { curriculumRegistry } from "./curriculum/catalog";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for Musica Mathematica.");
}

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";

createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary storage={demoMode ? undefined : browserStorage()}>
      <App
        curriculum={curriculumRegistry}
        demoMode={demoMode}
        storageFactory={demoMode ? () => createDemoStorage(curriculumRegistry) : undefined}
      />
    </RootErrorBoundary>
  </StrictMode>,
);
