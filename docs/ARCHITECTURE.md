# Architecture

## System boundary

Musica Mathematica is a static Vite application. It has no application server,
database, service worker, account system, or remote persistence service.

```text
index.html
  -> src/main.tsx
  -> src/App.tsx
  -> src/labs/catalog.ts
  -> src/components/workbench/
  -> src/labs/evaluate.ts
  -> domain evaluator or local audio result
```

`src/main.tsx` mounts React and imports KaTeX and application styles.
`src/App.tsx` owns lesson selection, hash routing, portfolio persistence, JSON
export, clearing, and presentation mode.

Lesson routes use
`#/labs/<domain-id>/lessons/<lesson-id>`. Invalid fragments are replaced with
the current valid route.

## Curriculum and evaluation

`src/labs/catalog.ts` and `src/labs/catalogAdvancedDomains.ts` define eight
domains with three lessons each. A lesson declares identifiers, display text,
factors, protocol, claim references, source references, and input modes.

`src/labs/evaluate.ts` dispatches lessons to deterministic evaluators.
Domain-specific code is under `src/labs/`. The delayed ensemble implementation
is under `src/simulation/`. These modules do not depend on browser APIs.

An evaluation contains:

- headline and display result;
- typed observables;
- bounded trace points and axis metadata;
- provenance and calibration status;
- claim identifiers; and
- an interpretation annotation.

The claim taxonomy is defined in `src/learning/evidence.ts` and documented in
`SCIENTIFIC_AUDIT.md`.

## Inquiry and portfolio state

The lesson stages are `orient`, `predict`, `experiment`, `compare`, `explain`,
`perform`, `transfer`, and `debrief`. Transition functions in `src/learning/`
enforce required prediction, trial, and response data.

Version 2 portfolio records use the key
`musicaMathematica.learning.v2`. Validation occurs on load, update, save, and
export. Each lesson retains at most 12 trials. Each trial retains at most 256
trace points.

If no valid version 2 portfolio exists, the loader can copy a valid
`ensembleCouplingLab.learning.v1` record into an Ensemble Dynamics lesson. It
converts delay and jitter from seconds to milliseconds and marks trials with a
legacy protocol identifier. It does not delete the version 1 key. The clear
action removes both keys.

If `localStorage` is unavailable or rejects a write, the application continues
with in-memory state and reports the persistence failure.

## Local audio

Three critique lessons support optional microphone and file input.

```text
microphone
  -> MediaStream
  -> AudioWorklet
  -> bounded MessagePort and queue
  -> module Web Worker
  -> derived features and hypotheses

file
  -> AudioBuffer decode
  -> bounded mono selection
  -> module Web Worker
  -> derived features and hypotheses
```

`src/audio/` contains input validation, worklet and worker coordination,
FFT-backed analysis, hypothesis ranking, and safe media settings. Worklet frames
and file selections are transferred to workers. Raw audio is transient and is
not accepted by the portfolio schema.

Only Recorded-Onset Hypotheses permits an audio-derived portfolio comparison.
Chord Hypotheses and Time-Varying Timbre show audio results as observation
appendices while their stored controlled comparisons remain synthetic.

See `docs/LOCAL_AUDIO_METHOD.md` for numerical limits and method details.

## Network and privacy

Application code does not call `fetch`, `XMLHttpRequest`, `WebSocket`,
`EventSource`, or beacon APIs. Source citations are external links opened after
user action.

The Content Security Policy in `index.html` restricts scripts, images, fonts,
and connections to the same origin, with loopback WebSocket access for the Vite
development server. UI fonts are served from `public/fonts/`. KaTeX fonts are
included in the build.

Portfolio export creates a local JSON download. The application has no portfolio
import or restore path. Microphone permission, source selection, codec support,
and browser site-data controls remain platform responsibilities.

## Build and deployment

`pnpm build` runs TypeScript and Vite. Vite writes the static bundle to `dist/`.
The current source uses root-relative public paths, so deployment is configured
for an origin root rather than a subpath.

Hash routes do not require server-side route rewriting. The static host must
serve `index.html` and the `/assets/`, `/fonts/`, favicon, and license files from
the same origin.

The repository has no container, server process, hosting manifest, deployment
command, or rollback procedure.

## Tests and CI

- Colocated `src/**/*.test.ts(x)` files run in Vitest's Node environment and
  cover models, learning state, storage, migration, audio contracts, worker
  coordination, and component output.
- Playwright starts its own Vite server on strict port `4174` and runs the
  workflows under `tests/e2e/`.
- `.github/workflows/ci.yml` uses Node 22 and pnpm 11.6.0, installs Chromium and
  Linux browser dependencies, and runs `pnpm verify`.

Build output, Playwright output, coverage, caches, and local tool state are
ignored.

## Compatibility surfaces

The following values affect stored records, routes, tests, or current browser
behavior:

- domain, lesson, protocol, claim, and input-mode identifiers;
- `musicaMathematica.learning.v2` and the version 2 portfolio shape;
- `ensembleCouplingLab.learning.v1` migration behavior;
- trial and trace caps;
- ensemble configuration, topology, texture, metrics, and fixed-step behavior;
- audio frame sizes and input limits; and
- exported JSON fields.

Changes to these surfaces require focused tests and an explicit compatibility
decision.
