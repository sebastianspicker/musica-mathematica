# Architecture

Musica Mathematica is a static React and Vite application. Lessons, learning
records, and optional audio analysis all run in the browser. The workers and
AudioWorklet are browser assets within the application bundle, not separate
services. The application has no server, accounts, database, remote storage,
analytics, or runtime API configuration.

## System context

```mermaid
flowchart LR
  learner[Learner or instructor] --> app[Musica Mathematica browser app]
  host[HTTPS static host] -->|HTML, JavaScript, CSS, fonts| app
  app -->|validated portfolio| storage[Browser localStorage]
  app -->|sanitized JSON| download[Browser download]
  media[Optional microphone or audio file] -->|transient local samples| app
```

The host serves the application files. Application code does not send portfolio
or audio data back to it. Portfolio export creates a local download, and the app
has no import or restore feature. The browser and operating system still control
media permissions and device access.

## Components and dependencies

```mermaid
flowchart TD
  main[src/main.tsx] --> app[src/app]
  app --> ui[src/ui]
  app --> curriculum[src/curriculum]
  app --> learning[src/learning]
  app --> browserAudio[src/audio/browser]
  app -->|result types| analysis[src/audio/analysis]
  curriculum -->|catalog.ts only| domains[src/domains]
  domains --> curriculum
  domains --> support[src/domains/support]
  domains --> shared[src/shared]
  ui --> curriculum
  ui --> learning
  learning -->|contracts| curriculum
  browserAudio --> protocol[src/audio/protocol]
  browserAudio --> analysis
  protocol --> analysis
  analysis --> shared
```

An arrow means that the source may depend on the target. `eslint.config.mjs`
enforces these edges with layer import zones. Sibling-relative imports into
`audio/browser` are covered as well. The one edge from `src/curriculum/` to
`src/domains/` is `catalog.ts`, the composition root and the only importer of
domain modules. Domains import only the curriculum contracts and registry,
`domains/support`, `src/shared/`, and their own files, never the catalog.
Learning code imports curriculum contracts and registry ports but not the
catalog. `src/shared/` is a leaf and imports neither the curriculum nor any
application layer. `src/app/` reaches domain content only through the
curriculum registry and does not import `domains`. `src/ui/` does not import
`app`, `audio`, `domains`, or the catalog.

| Area | Responsibility |
| --- | --- |
| `src/shared/numeric/` | Browser-independent numeric validation. |
| `src/curriculum/` | `contracts.ts` (lesson, factor and evaluation contracts, audio-analysis policy helpers, `seedForTrial`), `registry.ts` (validation and `defineDomain`), `catalog.ts` (composition root), `evidence.ts` (claims and research sources), and `__golden__/evaluations.json`. |
| `src/domains/<id>/` | Eight deterministic domains, each with `lessons.ts`, `evaluators.ts`, `model.ts`, and `index.ts`. `ensemble-dynamics` also has `config.ts` and a test-only `model.reference.test-helper.ts`. |
| `src/domains/support/` | `construction.ts` (definition builders) and `evaluation.ts` (`observable`, `result`, and `readNumber`, `readString`, `readBoolean`). |
| `src/learning/` | `stages.ts` (ordered stages); `inquiry/comparison.ts` (controlled A/B rule) and `inquiry/recording.ts` (recording blockers, factors for an attempt); `portfolio/` with `schema.ts` (persisted version 2 types, `StoragePort`, keys, limits), `aggregate.ts`, `validate.ts`, `compact.ts`, `repository.ts`; and `portfolio/legacy/` (version 1 schema, validation, migration). |
| `src/audio/analysis/` | Portable windowing, FFT-backed analysis, features, and ranked hypotheses. |
| `src/audio/protocol/` | Worker and AudioWorklet messages and bounded frame queues. |
| `src/audio/browser/` | Media capture, file decoding, workers, AudioWorklet integration, and resource cleanup. |
| `src/ui/` | Presentational React components driven by supplied state and callbacks. `format.ts` holds shared formatters and `workbench/types.ts` the runtime view contract. `audio/` holds the audio input controls. |
| `src/app/` | `App.tsx` (routing, focus, dialogs, layout); `portfolio/` (`usePortfolio.ts`, `browserStorage.ts`, `download.ts`); `routing/hashRoute.ts`; `workbench/` (lesson and playback controllers and `playbackStore.ts`); `audio/` (audio controllers and mapping of results to evaluations); and `demo/` (Pages-only seed and isolated storage). |

Domain logic, learning rules, and portable audio analysis do not use React, the
DOM, storage, Worker, AudioWorklet, or media APIs. Lint rejects a denylist of
browser globals, not every browser API, in these layers and in `src/ui/`, and it
rejects production imports of `*.test-helper` files. The legacy migration may
not import inquiry rules or curriculum evidence. `src/architecture.test.ts`
probes each import zone.

### Where new code goes

- A lesson goes in its domain's `lessons.ts`, with its evaluator in
  `evaluators.ts`, and the domain's `index.ts` registers both. A new domain is
  added through `src/curriculum/catalog.ts`. There is no central evaluator
  switch.
- Shared curriculum types and registry validation go in `src/curriculum/`.
  Generic numeric helpers go in `src/shared/`.
- Definition and evaluation helpers shared by domains go in
  `src/domains/support/`.
- Rendering goes in `src/ui/`. Stateful orchestration, routing, and browser
  adapters (storage, downloads, media) go in `src/app/` or
  `src/audio/browser/`.
- Tests are colocated as `*.test.ts(x)`. Shared test fixtures use the
  `*.test-helper.ts` suffix.

### Lesson policy lives in the curriculum

Lesson rules are data in the curriculum, not checks against lesson identifiers.
A factor may declare `audioSetting: "onsetSensitivity" | "meterBias"`. A lesson
with such factors supports controlled comparison of recorded audio, limited to
those factors, and those factors feed the audio analysis. The registry
validates the declarations. Claims and research sources come from
`src/curriculum/evidence.ts`, and the registry can check that every lesson
reference resolves. `seedForTrial` in `contracts.ts` derives a trial's random
seed from the lesson and its factors.

## Application and lesson flow

`index.html` loads `src/main.tsx`, which mounts `src/app/App.tsx` inside React
`StrictMode`. `App` resolves the hash route, selects the lesson, loads the
portfolio through an injected storage port, and composes the Lessons and My
learning dialogs with `LessonWorkbenchController`.

Lesson routes have the form `#/labs/<domain-id>/lessons/<lesson-id>`. When a
fragment does not identify a lesson, `App` replaces it with the current valid
route.

`LessonWorkbenchController` and `useLessonController` manage factor input,
evaluation, stage actions, playback, and optional audio requests. They pass a
view state to `src/ui/workbench/LessonWorkbench.tsx`. Numeric controls
can retain an invalid draft without passing it to a domain model, and native
form validation runs before a trial is recorded. A displayed audio observation
waits for current analysis instead of falling back to a synthetic result.

The workbench keeps an unrecorded preview separate from recorded evidence. A
learner must commit a prediction before experimenting, and comparison requires
two compatible trials. The ordered sequence of eight stages comes from
`src/learning/stages.ts`.

Playback advances with animation frames. Only the transport subscribes to
playhead updates, which are published at 10 Hz, with immediate notifications
when playback starts or stops. Stable memoized inputs keep playback from
recomputing unchanged charts, comparisons, and evidence. If lesson rendering
fails, its error boundary can retry with the default factors without discarding
saved attempts. `App` also manages focus after lesson and stage navigation;
native dialogs restore focus when dismissed with Escape.

`src/curriculum/catalog.ts` assembles the eight domains. The registry in
`src/curriculum/registry.ts` checks identifier uniqueness, exactly three lessons
per domain, evaluator coverage, factor definitions, and evaluator output. Each
domain maps its own lesson identifiers to evaluators.

## Portfolio state and privacy

`src/learning/portfolio/` defines the version 2 records and the code that
validates, sanitizes, aggregates, and stores them through `StoragePort`. The
production browser implementation is `src/app/portfolio/browserStorage.ts`.

The normal portfolio key is `musicaMathematica.learning.v2`. When no valid
version 2 record exists, the repository can copy one valid
`ensembleCouplingLab.learning.v1` record into the corresponding Ensemble
Dynamics lesson. It leaves the legacy record in place. The `labId` field name,
both storage keys, the migration behavior, and the exported fields are
compatibility contracts.

Validation and sanitization run when records are loaded, saved, and exported.
Each lesson keeps its newest 12 trials. A trial keeps at most 256
endpoint-sampled trace points, 16 factors with required lesson factors first,
and 24 observables. Responses and notes are limited to 16,384 Unicode code
points. Observable values and provenance methods are limited to 1,024 code
points, extension factor keys and values to 512, and display labels and trace
series names to 256. Canonical identifiers are preserved.

A compact serialized portfolio may contain at most 4 MiB of UTF-8 JSON. To meet
that limit, compaction first reduces traces, then removes the oldest trials that
are not needed for the comparison stage, and finally removes the oldest
non-active attempts. It retains the active attempt and the two trials required
at comparison and later stages. The UI reports compaction and storage failures.
If stored JSON is larger than 8 MiB, the app leaves the original value untouched,
disables automatic persistence, and displays recovery guidance.

Portfolio records never contain raw audio, encoded files, file names, media
streams, object URLs, or device identifiers.

The GitHub Pages build injects the adapter in `src/app/demo/`. It creates a
schema-valid 90 to 120 BPM comparison with the production evaluator and stores
it under `musicaMathematica.demo.learning.v2`. The adapter hides both normal and
legacy keys. Reading, editing, or resetting the demo therefore cannot read,
migrate, overwrite, or clear a learner's normal portfolio.

## Local audio flow

```mermaid
flowchart LR
  mic[Microphone after user action] --> worklet[AudioWorklet ring buffer]
  worklet -->|credit-bounded frames| worker[Web Worker]
  file[Browser-decodable file] -->|bounded mono selection| worker
  worker --> analysis[Portable signal analysis]
  analysis --> derived[Derived features and hypotheses]
  derived --> mapping[App audio-to-evaluation mapping]
  mapping --> result[Display and permitted trial snapshot]
```

A microphone capture lasts from 5 through 20 seconds. An audio file must have
an `audio/*` media type, occupy no more than 25 MiB, and decode to no more than
90 seconds. The selected range may be at most 30 seconds. Analysis uses frames
of 2,048 or 4,096 samples with 50% overlap. Credits on the worklet connection
and a bounded worker queue prevent an unlimited backlog. The provenance
dropped-frame total covers stale frames, overflow, and sequence gaps, while the
expensive analysis stays off the UI thread.

Only Recorded-Onset Hypotheses can save an audio-derived controlled-comparison
snapshot. Chord Hypotheses and Time-Varying Timbre show audio results as an
additional observation; their controlled portfolio trials remain synthetic.
The [audio guide](LOCAL_AUDIO_METHOD.md) describes the algorithms, cleanup,
privacy rules, and limits on interpretation.

## Builds and deployment

`pnpm build` runs `vite build` without a separate type-check, and writes an
origin-root bundle to `dist/`. `pnpm typecheck` covers the type-checking. `pnpm build:pages` runs Vite in `pages` mode, sets the base to
`/musica-mathematica/`, rewrites the favicon path, makes application, worker,
worklet, and font assets aware of that base, and enables isolated demo storage.

On pushes and pull requests, CI installs the frozen lockfile with Node 22 and
runs `pnpm verify`. The GitHub
Pages workflow is manual. It runs `pnpm typecheck` and `pnpm test:unit`, then
builds, uploads, and deploys the Pages artifact. Repository settings, the live origin, response
headers, and cache behavior remain part of the deployment environment.
`index.html` includes a same-origin meta Content Security Policy, with loopback
WebSocket access for Vite development. A deployed host should also send
appropriate security headers.

## Stable contracts and extension points

Changes to the following values need focused tests and an explicit compatibility
or migration decision:

- route, domain, lesson, protocol, claim, factor, and input-mode identifiers;
- factor bounds, select options, and protocol identifiers, because stored
  trials whose values fall outside the current definitions are dropped on load
  (`src/curriculum/compatibility.test.ts` freezes them);
- `LessonDefinition`, `EvaluationOutput`, storage keys, portfolio version 2,
  trial and trace caps, export fields, and legacy migration behavior;
- audio frame sizes, input limits, queue capacity, and worker and AudioWorklet
  messages; and
- the origin-root and project-subpath asset assumptions of the two build modes.

See "Where new code goes" above for placement. New storage, media, or download
behavior belongs behind a port or browser adapter rather than in domain or
learning code.

## What local verification covers

Tests are colocated with the code they cover and run in Vitest's Node
environment. [CONTRIBUTING.md](../CONTRIBUTING.md) lists the commands and what
each runs. Golden files pin evaluator output
(`src/curriculum/__golden__/evaluations.json`, compared with a relative
tolerance of 1e-6 because floating-point results differ across platforms) and
the exported portfolio JSON (`src/learning/portfolio/golden-json.test.ts`). An
intentional model change regenerates the evaluator golden file, and that diff is
reviewed as a behavior change. The unit tests also check asset URLs in the Pages
build.

Local automated checks cannot establish browser permission behavior, microphone
hardware behavior, codec availability, applied media constraints, deployed
response headers, or the state of the live Pages site. The application also does
not provide accounts, remote storage, course authoring, LMS integration,
grading, calibrated measurement, complete transcription, or validated
assessment. [Scientific Basis](SCIENTIFIC_BASIS.md) explains how its outputs
should be interpreted.
