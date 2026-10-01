import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const coreRules = {
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

/**
 * @param {string[]} forbidden
 * @param {string} message
 * @param {string[]} [siblingRegexes]
 */
function restrictImports(forbidden, message, siblingRegexes = []) {
  return ["error", {
    patterns: [
      {
        // `no-restricted-imports` matches these against the import specifier, so
        // `**/app` catches every relative depth without banning sibling files.
        group: forbidden.flatMap((path) => [`**/${path}`, `**/${path}/**`]),
        message,
      },
      // Sibling-relative specifiers such as `../browser/capture` never contain
      // the layer prefix, so the globs above cannot see them.
      ...siblingRegexes.map((regex) => ({ regex, message })),
    ],
  }];
}

// Inside src/audio/{analysis,protocol}, `../browser` reaches audio/browser.
const audioBrowserSiblingImports = ["^(\\.\\./)+browser(/|$)"];

const applicationImports = ["app", "ui", "audio", "learning", "domains", "react", "react-dom"];
const domainImports = ["app", "ui", "audio", "learning", "curriculum/catalog", "react", "react-dom"];

// Fixtures shared by tests live in `*.test-helper.ts` and must never reach production code.
const testFileGlobs = ["**/*.test.*", "**/*.test-helper.ts"];
const testHelperImports = {
  group: ["**/*.test-helper"],
  message: "Test helpers may be imported only from tests and other test helpers.",
};

/**
 * Flat config replaces rule options per file, so the test-helper ban is merged
 * into every layer's `no-restricted-imports` block for non-test files.
 * @param {any[]} blocks
 */
function forbidTestHelperImports(blocks) {
  const base = {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: testFileGlobs,
    rules: { "no-restricted-imports": ["error", { patterns: [testHelperImports] }] },
  };
  return [base, ...blocks.flatMap((block) => {
    const rule = block.rules?.["no-restricted-imports"];
    if (!rule || !block.files) return [block];
    const [severity, options] = rule;
    return [block, {
      files: block.files,
      ignores: testFileGlobs,
      rules: { "no-restricted-imports": [severity, { ...options, patterns: [...options.patterns, testHelperImports] }] },
    }];
  })];
}

const portableLayerGlobs = [
  "src/{shared,curriculum,domains,learning,ui}/**/*.{ts,tsx}",
  "src/audio/{analysis,protocol}/**/*.{ts,tsx}",
];

// A denylist, not a complete inventory of browser APIs: it names the globals the code base could plausibly reach for.
const browserGlobals = [
  "window", "document", "navigator", "localStorage", "sessionStorage",
  "globalThis", "self", "location", "history", "indexedDB", "caches",
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
  "AudioContext", "OfflineAudioContext", "AudioWorkletNode", "MediaRecorder",
  "FileReader", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "screen",
  "alert", "confirm", "prompt", "Notification",
  "addEventListener", "removeEventListener", "dispatchEvent", "crypto", "Blob", "URL",
  "scrollTo", "queueMicrotask", "postMessage", "ResizeObserver", "IntersectionObserver",
  "MutationObserver", "requestIdleCallback",
];

/** @param {string[]} names */
function restrictGlobals(names) {
  return ["error", ...names.map((name) => ({ name, message: "Browser APIs belong in app or audio/browser adapters; inject data and callbacks here." }))];
}

const domainBoundaryConfigs = domainNames.map((domain) => ({
  files: [`src/domains/${domain}/**/*.ts`, `src/domains/${domain}/**/*.tsx`],
  rules: {
    "no-restricted-imports": restrictImports(
      [...domainImports, ...domainNames.filter((name) => name !== domain)],
      "Domain modules may depend only on curriculum, shared utilities, their own domain, and domains/support.",
    ),
  },
}));

export default forbidTestHelperImports([
  {
    // ESLint does not read the ignore file of the version control system.
    ignores: [
      "node_modules/", "dist/", "coverage/", ".playwright-results/", "playwright-report/",
      "test-results/", "blob-report/", "output/", "design-preview/", ".internal/",
      ".serena/", ".codacy/", ".codegraph/", ".claude/", ".codex/", ".agents/", "**/.tmp-*",
    ],
  },
  {
    files: portableLayerGlobs,
    ignores: testFileGlobs,
    rules: { "no-restricted-globals": restrictGlobals(browserGlobals) },
  },
  {
    // The analysis benchmark is the one place that times work in a portable layer.
    files: portableLayerGlobs,
    ignores: [...testFileGlobs, "src/audio/analysis/**/*.bench.ts"],
    rules: { "no-restricted-globals": restrictGlobals([...browserGlobals, "performance"]) },
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
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      parser: typescriptParser,
    },
    rules: coreRules,
  },
  {
    files: ["benchmarks/**/*.mjs", "scripts/**/*.mjs", "**/*.config.*", "e2e/**"],
    languageOptions: { globals: globals.node },
  },
  {
    // These scripts and fixtures run in the page or pass callbacks to Playwright's `page.evaluate`.
    files: ["benchmarks/workbench.mjs", "benchmarks/workbenchProfileMain.tsx", "e2e/fixtures/**", "scripts/capture-screenshots.mjs"],
    languageOptions: { globals: globals.browser },
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
        [...applicationImports, "curriculum"],
        "Shared utilities are a leaf: independent of application layers and curriculum.",
      ),
    },
  },
  {
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["domains"],
        "App modules reach domain content only through the curriculum registry.",
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
    files: ["src/learning/portfolio/legacy/**/*.ts", "src/learning/portfolio/legacy/**/*.tsx"],
    rules: {
      "no-restricted-imports": restrictImports(
        ["app", "ui", "audio", "domains", "curriculum/evidence", "inquiry", "curriculum/catalog", "react", "react-dom"],
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
        audioBrowserSiblingImports,
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
]);
