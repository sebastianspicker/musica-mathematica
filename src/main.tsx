import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "katex/dist/katex.min.css";
import "./styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for Musica Mathematica.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
