import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

const codacyRules = {
  "constructor-super": ["error"],
  "for-direction": ["error"],
  "getter-return": ["error", { allowImplicit: false }],
  "no-async-promise-executor": ["error"],
  "no-case-declarations": ["error"],
  "no-class-assign": ["error"],
  "no-compare-neg-zero": ["error"],
  "no-cond-assign": ["error", "except-parens"],
  "no-constant-condition": ["error", { checkLoops: true }],
  "no-const-assign": ["error"],
  "no-control-regex": ["error"],
  "no-debugger": ["error"],
  "no-delete-var": ["error"],
  "no-dupe-args": ["error"],
  "no-dupe-class-members": ["error"],
  "no-dupe-else-if": ["error"],
  "no-dupe-keys": ["error"],
  "no-duplicate-case": ["error"],
  "no-empty": ["error", { allowEmptyCatch: false }],
  "no-empty-character-class": ["error"],
  "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: false }],
  "no-ex-assign": ["error"],
  "no-extra-boolean-cast": ["error", { enforceForLogicalOperands: false }],
  "no-extra-semi": ["error"],
  "no-fallthrough": ["error", { allowEmptyCase: false }],
  "no-func-assign": ["error"],
  "no-global-assign": ["error"],
  "no-import-assign": ["error"],
  "no-inner-declarations": ["error", "functions"],
  "no-invalid-regexp": ["error"],
  "no-irregular-whitespace": ["error", {
    skipComments: false,
    skipJSXText: false,
    skipRegExps: false,
    skipStrings: true,
    skipTemplates: false,
  }],
  "no-loss-of-precision": ["error"],
  "no-misleading-character-class": ["error"],
  "no-mixed-spaces-and-tabs": ["error"],
  "no-new-symbol": ["error"],
  "no-nonoctal-decimal-escape": ["error"],
  "no-obj-calls": ["error"],
  "no-octal": ["error"],
  "no-prototype-builtins": ["error"],
  "no-redeclare": ["error", { builtinGlobals: true }],
  "no-regex-spaces": ["error"],
  "no-self-assign": ["error", { props: true }],
  "no-setter-return": ["error"],
  "no-shadow-restricted-names": ["error"],
  "no-sparse-arrays": ["error"],
  "no-this-before-super": ["error"],
  "no-undef": ["error", { typeof: false }],
  "no-unexpected-multiline": ["error"],
  "no-unreachable": ["error"],
  "no-unsafe-finally": ["error"],
  "no-unsafe-negation": ["error", { enforceForOrderingRelations: false }],
  "no-unsafe-optional-chaining": ["error", { disallowArithmeticOperators: false }],
  "no-unused-labels": ["error"],
  "no-unused-vars": ["error"],
  "no-useless-backreference": ["error"],
  "no-useless-catch": ["error"],
  "no-useless-escape": ["error"],
  "no-with": ["error"],
  "require-yield": ["error"],
  "use-isnan": ["error", { enforceForIndexOf: false, enforceForSwitchCase: true }],
  "valid-typeof": ["error", { requireStringLiterals: false }],
};

const domainNames = [
  "ensemble-dynamics",
  "harmony-geometry",
  "measurement-inference",
  "phase-proportion",
  "pitch-tuning",
  "probability-form",
  "rhythm-meter",
  "timbre-acoustics",
];

function restrictImports(forbidden, message) {
  return ["error", {
    patterns: [{
      // `no-restricted-imports` matches these against the import specifier, so
      // `**/app` catches every relative depth without banning sibling files.
      group: forbidden.flatMap((path) => [`**/${path}`, `**/${path}/**`]),
      message,
    }],
  }];
}

const applicationImports = ["app", "ui", "audio", "learning", "domains", "react", "react-dom"];
const domainImports = ["app", "ui", "audio", "learning", "react", "react-dom"];

const domainBoundaryConfigs = domainNames.map((domain) => ({
  files: [`src/domains/${domain}/**/*.ts`, `src/domains/${domain}/**/*.tsx`],
  rules: {
    "no-restricted-imports": restrictImports(
      [...domainImports, ...domainNames.filter((name) => name !== domain)],
      "Domain modules may depend only on curriculum, shared utilities, their own domain, and domains/support.",
    ),
  },
}));

export default [
  {
    files: [
      "src/{shared,curriculum,domains,learning,ui}/**/*.{ts,tsx}",
      "src/audio/{analysis,protocol}/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.*"],
    rules: {
      "no-restricted-globals": ["error", ...[
        "window", "document", "navigator", "localStorage", "sessionStorage",
        "globalThis", "self", "location", "history", "indexedDB", "caches",
        "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
        "AudioContext", "OfflineAudioContext", "AudioWorkletNode", "MediaRecorder",
        "FileReader", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia",
        "setTimeout", "clearTimeout", "setInterval", "clearInterval", "screen",
        "alert", "confirm", "prompt", "Notification",
      ].map((name) => ({ name, message: "Browser APIs belong in app or audio/browser adapters; inject data and callbacks here." }))],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.cjs", "**/*.vue"],
    languageOptions: {
      parser: typescriptParser,
    },
    rules: codacyRules,
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error"],
    },
  },
  {
    files: ["src/shared/**/*.ts", "src/shared/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        applicationImports,
        "Shared utilities must remain independent of application layers.",
      ),
    },
  },
  {
    files: ["src/curriculum/**/*.ts", "src/curriculum/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        applicationImports,
        "Curriculum modules may depend only on shared utilities and curriculum modules.",
      ),
    },
  },
  {
    // Catalog composition is the sole intentional curriculum-to-domain edge.
    files: ["src/curriculum/catalog.ts"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "ui", "audio", "learning", "react", "react-dom"],
        "The curriculum catalog may compose domain definitions, but must remain independent of application layers.",
      ),
    },
  },
  {
    files: ["src/domains/support/**/*.ts", "src/domains/support/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        [...domainImports, ...domainNames],
        "Domain support modules may depend only on curriculum, shared utilities, and domain support modules.",
      ),
    },
  },
  ...domainBoundaryConfigs,
  {
    files: ["src/learning/**/*.ts", "src/learning/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "ui", "audio", "domains", "curriculum/catalog", "react", "react-dom"],
        "Learning modules may depend only on curriculum contracts and registry ports, shared utilities, and learning modules.",
      ),
    },
  },
  {
    files: ["src/learning/legacy-v1/**/*.ts", "src/learning/legacy-v1/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "ui", "audio", "domains", "evidence", "inquiry", "curriculum/catalog", "react", "react-dom"],
        "Legacy v1 may depend only on its own modules, learning/portfolio, curriculum contracts and registry ports, and shared utilities.",
      ),
    },
  },
  {
    files: ["src/audio/analysis/**/*.ts", "src/audio/analysis/**/*.tsx", "src/audio/protocol/**/*.ts", "src/audio/protocol/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "ui", "learning", "domains", "audio/browser", "react", "react-dom"],
        "Audio analysis and protocol modules must remain independent of application, UI, learning, domain, and browser-adapter layers.",
      ),
    },
  },
  {
    files: ["src/audio/browser/**/*.ts", "src/audio/browser/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "ui", "learning", "domains"],
        "Browser audio adapters may depend on audio analysis and protocol, but not application layers.",
      ),
    },
  },
  {
    files: ["src/ui/**/*.ts", "src/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "audio", "domains", "curriculum/catalog"],
        "UI components must render from supplied data and must not import application or browser-adapter modules.",
      ),
    },
  },
];
