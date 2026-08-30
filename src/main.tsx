import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { curriculumRegistry } from "./curriculum/catalog";
import "katex/dist/katex.min.css";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for Musica Mathematica.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App curriculum={curriculumRegistry} />
  </StrictMode>,
);
