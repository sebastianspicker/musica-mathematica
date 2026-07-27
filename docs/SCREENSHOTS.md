# Screenshot maintenance

The README uses two Chromium screenshots:

- `docs/assets/screenshots/workbench-overview.png`
- `docs/assets/screenshots/controlled-comparison.png`

## Prerequisites

Install dependencies and Playwright Chromium:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

## Capture

Run:

```sh
node scripts/capture-readme-screenshots.mjs
```

The script starts Vite on strict port `4175`, clears browser `localStorage`,
captures a 1440 by 1000 default lesson, records a controlled 90-to-120 BPM
comparison, and overwrites both PNG files.

## Review

Before accepting replacements:

1. Confirm the app title, lesson, factor values, result, and comparison state.
2. Check that privacy, calibration, and disabled-control labels match runtime
   state.
3. Check visible focus, text clipping, chart labels, and horizontal overflow.
4. Run `pnpm verify`.
5. Confirm README links and alt text still describe the images.

The capture script covers one desktop Chromium viewport. It does not establish
mobile, cross-browser, screen-reader, or classroom-projection conformance.
