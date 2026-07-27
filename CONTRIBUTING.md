# Contributing

## Prerequisites

Use a Node.js version allowed by `package.json` and pnpm `11.6.0`.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Start the application with:

```sh
pnpm dev
```

Open <http://127.0.0.1:5173/>.

## Change guidelines

- Keep changes focused on one behavior or documentation contract.
- Preserve deterministic model behavior unless the change explicitly modifies
  the model.
- Do not change lesson identifiers, protocol identifiers, claim identifiers,
  input-mode values, storage keys, or portfolio shapes without migration and
  compatibility evidence.
- Keep raw audio, file names, device identifiers, and media streams outside
  portfolio storage and exports.
- Keep model and audio claims within the limits in
  `SCIENTIFIC_AUDIT.md` and `docs/LOCAL_AUDIO_METHOD.md`.
- Do not add production dependencies without maintainer approval.

## Tests

Add or update focused tests for changes to models, lesson definitions, portfolio
behavior, storage, migration, audio processing, or browser workflows.

Run the narrowest relevant command first, then run:

```sh
pnpm verify
```

Use `pnpm test:unit` for Vitest and `pnpm test:e2e` for Playwright Chromium.
`pnpm verify` runs ESLint, TypeScript, the unit suite, the production build, and
the end-to-end suite. If a check cannot run, record the exact command and
failure.

## Documentation

Update documentation in the same change when behavior, commands, routes,
configuration, storage, input limits, or compatibility surfaces change.

Before changing README screenshots, follow
[docs/SCREENSHOTS.md](docs/SCREENSHOTS.md). Do not edit screenshot files by
hand.

Use direct technical language. Avoid claims not established by source, tests,
or documented research. Do not use model output as evidence of performer
quality, network readiness, or pedagogical effectiveness.

## Pull requests

A pull request should identify:

- the behavior or documentation contract changed;
- the files and compatibility surfaces affected;
- the commands run and their results;
- checks that were skipped;
- remaining uncertainty; and
- any user-data, audio, security, or scientific-claim impact.

Do not include secrets, private audio, learner portfolio exports, or
machine-specific files.
