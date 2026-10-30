import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const pagesBase = "/musica-mathematica/";

// The Vite development server needs inline styles and its HMR WebSocket; built bundles need neither.
const developmentOnlyCsp = [" 'unsafe-inline'", " ws://127.0.0.1:* ws://localhost:*"];

function productionCsp(html: string): string {
  return developmentOnlyCsp.reduce((result, source) => {
    if (!result.includes(source)) throw new Error(`index.html CSP no longer contains "${source.trim()}"; update vite.config.ts.`);
    return result.replace(source, "");
  }, html);
}

export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === "pages";

  return {
    base: isPagesBuild ? pagesBase : undefined,
    define: {
      "import.meta.env.VITE_DEMO_MODE": JSON.stringify(isPagesBuild ? "true" : "false"),
    },
    plugins: [
      react(),
      { name: "production-csp", apply: "build" as const, transformIndexHtml: productionCsp },
      ...(isPagesBuild
        ? [
            {
              name: "pages-favicon-base",
              transformIndexHtml: (html: string) =>
                html.replace('href="/favicon.svg"', `href="${pagesBase}favicon.svg"`),
            },
          ]
        : []),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.{js,ts,tsx}"],
    },
  };
});
