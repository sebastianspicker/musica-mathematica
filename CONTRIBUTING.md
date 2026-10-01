# Contributing

Thanks for helping improve the lessons, models, interface, or documentation.
Keep a change focused on one problem and include a way to check the result.

## Run the app

Use Node.js `^20.19.0`, `^22.13.0`, or `>=24` and pnpm `11.6.0`, as
specified in [package.json](package.json).

```sh
pnpm install --frozen-lockfile
```

Start the application with:

```sh
pnpm dev
```

Open <http://127.0.0.1:5173/>.

## Working on a change

Models should produce the same results for the same inputs unless the change
intentionally revises the model. Keep model and audio interpretations within
the limits described in the [scientific basis](docs/SCIENTIFIC_BASIS.md) and
[audio guide](docs/LOCAL_AUDIO_METHOD.md).

Lesson, protocol, and claim identifiers, input modes, storage keys, and
portfolio formats connect several parts of the app. If you change one, explain
how existing records and callers will continue to work, and test the migration
where needed. Raw audio, file names, device identifiers, and media streams must
stay out of stored portfolios and exports.

Browser APIs belong in `src/app/` or `src/audio/browser/`. Keep models portable
and UI components focused on rendering supplied state. The
[architecture guide](docs/ARCHITECTURE.md) explains where code belongs.
Discuss new production dependencies with a maintainer before adding them.

## Tests and verification

Add or update focused tests for changes to models, lesson definitions, portfolio
behavior, storage, migration, or audio processing. Tests are colocated as
`*.test.ts(x)`. Shared test fixtures use the `*.test-helper.ts` suffix, and
production code may not import them.

| Command | What it runs |
| --- | --- |
| `pnpm dev` | The Vite development server. |
| `pnpm lint` | `eslint .` over the whole repository (ESLint 10 flat config with explicit ignores). It checks React Hooks, import boundaries between layers, and browser-global bans in portable layers. |
| `pnpm typecheck` | `tsc --noEmit` for the browser program (`src`, `e2e/fixtures`, `benchmarks/*.tsx`), then `tsc --noEmit -p tsconfig.node.json` for e2e specs, the Pages bundle build test (`src/**/*.build.test.ts`), `playwright.config.ts`, `vite.config.ts`, and `eslint.config.mjs`. |
| `pnpm test:unit` | `vitest run`. |
| `pnpm build` | `vite build` for the origin-root bundle. It does not type-check. |
| `pnpm build:pages` | `vite build --mode pages` for the GitHub Pages demo. Not part of `pnpm verify`. |
| `pnpm verify` | Lint, typecheck, unit tests, then build. |
| `pnpm test:e2e` | Playwright over the root and Pages builds in Chromium, Firefox, and WebKit. |

Run the narrowest relevant command first, then `pnpm verify`. If a check
cannot run, record the exact command and failure. CI runs `pnpm verify` and,
in a separate job, `pnpm test:e2e`.

Browser checks need the browsers installed once:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

The browser suite covers complete lessons, numeric limits, navigation focus,
playback, reduced motion, restart, clearing, export, storage separation, and
analysis of generated audio files. It does not test microphone hardware.

Evaluator outputs are pinned by `src/curriculum/__golden__/evaluations.json`,
which `evaluator-golden.test.ts` compares with a relative tolerance of 1e-6.
An intentional model change regenerates that file, and its diff is reviewed as
a behavior change. `src/learning/portfolio/golden-json.test.ts` pins the exact
exported portfolio JSON. Performance checks are in
[docs/PERFORMANCE.md](docs/PERFORMANCE.md).

### Preview the Pages demo

```sh
pnpm build:pages
pnpm exec vite preview --host 127.0.0.1 --port 4175 --strictPort --mode pages
```

Open <http://127.0.0.1:4175/musica-mathematica/>. The [deployment
guide](docs/DEPLOYMENT.md) covers publishing.

## Documentation

Update the relevant guide when you change behavior, commands, routes, storage,
configuration, or input limits. Write for someone who has not seen the issue
or pull-request discussion. Explain what works now and where the limits are;
support technical and scientific claims with source, tests, or research.

### README screenshots

Capture the running app with synthetic data. Check the lesson and factor values,
privacy and calibration labels, keyboard focus, chart labels, and text layout.
Keep the image paths and alt text accurate, and fix the app or capture setup
instead of retouching a screenshot.

To refresh the README tour, serve the Pages demo as described above. In another
terminal, run:

```sh
pnpm exec playwright install chromium
node scripts/capture-screenshots.mjs
```

The script opens a fresh Chromium context, uses synthetic example data, and
replaces four PNGs in `docs/assets/screenshots/`. It checks the page title,
demo label, prediction-to-comparison flow, console errors, and horizontal
overflow. Review all four images before including them in a pull request.
Pass a local preview URL as the first argument if you use a different port.

## Pull requests

Explain what changed, why, and how you checked it. Mention any checks you
could not run and any relevant compatibility, privacy, audio, or scientific
claim changes. A small fix usually needs only a few sentences.

Do not include secrets, private audio, learner portfolio exports, or
machine-specific files.
