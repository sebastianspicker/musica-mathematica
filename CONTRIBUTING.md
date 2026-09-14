# Contributing

Thanks for helping improve the lessons, models, interface, or documentation.
Keep a change focused on one problem and include a way to check the result.

## Run the app

Use Node.js `^20.19.0` or `>=22.12.0` and pnpm `11.6.0`, as specified in
[package.json](package.json).

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

## Tests

Add or update focused tests for changes to models, lesson definitions, portfolio
behavior, storage, migration, or audio processing.

Run the narrowest relevant command first, then run:

```sh
pnpm verify
```

Use `pnpm test:unit` for Vitest. `pnpm verify` runs ESLint, TypeScript, the
unit suite, and the production build. If a check cannot run, record the exact
command and failure.

Browser checks run separately against production root and Pages builds in
Chromium, Firefox, and WebKit:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e
```

The browser suite covers complete lessons, numeric limits, navigation focus,
playback, reduced motion, restart, clearing, export, storage separation, and
analysis of generated audio files. It does not test microphone hardware.
ESLint checks React Hooks and the separation between portable code, UI, and
browser adapters.

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

To refresh the README tour, build and serve the Pages demo:

```sh
pnpm build:pages
pnpm exec vite preview --host 127.0.0.1 --port 4175 --strictPort --mode pages
```

In another terminal, run:

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
