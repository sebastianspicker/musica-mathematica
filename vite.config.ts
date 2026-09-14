import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const pagesBase = "/musica-mathematica/";

export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === "pages";

  return {
    base: isPagesBuild ? pagesBase : undefined,
    define: {
      "import.meta.env.VITE_DEMO_MODE": JSON.stringify(isPagesBuild ? "true" : "false"),
    },
    plugins: [
      react(),
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
