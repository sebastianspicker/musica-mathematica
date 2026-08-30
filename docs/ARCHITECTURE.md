# Architecture

Musica Mathematica is a static React and Vite application. It has no
application server, account system, database, remote persistence, or runtime
API configuration. Lessons, portfolios, and optional audio analysis run in the
browser.

## Runtime composition

```text
index.html
  -> src/main.tsx
  -> src/app/App.tsx
  -> src/app/workbench/          stateful lesson orchestration
  -> src/ui/workbench/           rendering
  -> curriculum, domains, learning, and audio boundaries
```

`src/main.tsx` mounts the React tree and imports global styles. `src/app/App.tsx`
selects the active lesson, keeps the URL fragment valid, loads and saves the
portfolio, and coordinates export, clearing, and presentation mode.

Lesson URLs use `#/labs/<domain-id>/lessons/<lesson-id>`. An unknown fragment
is replaced with the active valid route.

## Modules and dependency direction

| Area | Responsibility | May depend on |
| --- | --- | --- |
| `src/shared/` | Small generic utilities, including numeric validation. | No application layers. |
| `src/curriculum/` | Lesson contracts and registry validation. `catalog.ts` assembles all domains. | `src/domains/` only at catalog assembly. |
| `src/domains/` | Lesson definitions, deterministic models, and evaluators for eight domains. | `curriculum` contracts and `shared` utilities. |
| `src/learning/` | Inquiry stages, evidence, source records, portfolio schema, migration, and repository functions. | `curriculum` contracts and `shared` utilities. |
| `src/audio/analysis/` | Portable FFT-backed analysis, features, and hypotheses. | `audio` analysis contracts only. |
| `src/audio/protocol/` | Worker and AudioWorklet message types plus bounded frame queues. | `audio/analysis` contracts. |
| `src/audio/browser/` | Browser capture, decoding, Worker, and AudioWorklet adapters. | `audio/analysis` and `audio/protocol`. |
| `src/ui/` | Presentational React components. | Typed input contracts. |
| `src/app/` | Browser routing, persistence/download adapters, controllers, and UI composition. | All lower-level contracts and adapters. |

Domain, learning, and portable analysis code must not depend on React, DOM,
`localStorage`, Worker, AudioWorklet, or media APIs. Browser adapters belong in
`src/app/` or `src/audio/browser/`. Presentational components belong in
`src/ui/`; stateful coordination belongs in `src/app/`.

## Curriculum and evaluations

`src/curriculum/contracts.ts` defines lessons, factors, provenance, traces, and
`EvaluationOutput`. `src/curriculum/registry.ts` validates that each domain has
exactly three lessons and an evaluator for each lesson. `src/curriculum/catalog.ts`
is the canonical registry of the eight domain modules.

Each `src/domains/<domain>/` directory contains the domain definition, lessons,
evaluators, and any domain model. A domain evaluator accepts selected factor
values and returns a validated `EvaluationOutput`; it neither reads browser
state nor selects routes. `src/domains/support/` holds shared domain-construction
and result helpers.

Add a lesson in its domain's `lessons.ts`, provide the matching evaluator in
`evaluators.ts`, and keep the domain's public `index.ts` definition aligned.
Add a new domain through `src/curriculum/catalog.ts`. Do not add a global
evaluator dispatcher.

## Inquiry and portfolio

`src/learning/stages.ts` owns the ordered lesson stages. `src/learning/inquiry/`
owns controlled-comparison rules.
`src/learning/evidence/` owns claim and source records. `src/learning/portfolio/`
owns the version 2 schema, validation, sanitization, aggregation, migration,
and repository functions.

Persistence is behind `StoragePort`; the browser adapter is
`src/app/portfolio/browserStorage.ts`. A valid portfolio is stored under
`musicaMathematica.learning.v2`. The JSON schema intentionally retains `labId`,
and a valid `ensembleCouplingLab.learning.v1` record may be migrated into the
corresponding Ensemble Dynamics attempts. Both are compatibility contracts.

Records are validated and sanitized on load, save, and export. The application
stores no raw audio, file names, media streams, or device identifiers. Export is
a local JSON download; there is no import or restore path.

## Local audio analysis

```text
microphone
  -> AudioWorklet -> bounded MessagePort -> Worker -> derived features

audio file
  -> browser decode -> bounded mono selection -> Worker -> derived features

derived result
  -> src/app/audio/ mapping -> lesson evaluation and optional trial snapshot
```

`src/audio/analysis/` performs windowing, spectrum generation, features, and
hypothesis formation. `src/audio/protocol/` defines transferable messages and
the bounded queue. `src/audio/browser/` owns capture, decoding, worker creation,
and the AudioWorklet module URL. `src/app/audio/` coordinates a user-initiated
request and maps a completed analysis into a lesson evaluation.

The UI accepts only the documented bounded input: microphone capture from 5 to
20 seconds, audio files up to 25 MiB and 90 decoded seconds, and selections up
to 30 seconds. Supported frame sizes are 2,048 and 4,096 samples with 50%
overlap. Raw media is transient. See [LOCAL_AUDIO_METHOD.md](LOCAL_AUDIO_METHOD.md)
for the processing method and interpretation limits.

## External contracts

These values have consumers outside their defining file and require focused
tests plus an explicit compatibility decision when changed:

- route, domain, lesson, protocol, claim, factor, and input-mode identifiers;
- `LessonDefinition`, `EvaluationOutput`, portfolio version 2 schema, storage
  keys, trial and trace caps, and exported JSON fields;
- legacy portfolio migration behavior;
- audio frame sizes, queue capacity, worker and worklet message shapes, and
  media input limits; and
- static-origin assumptions: root-relative public assets and hash routing.

`index.html` defines the Content Security Policy. The production application
does not provide a backend connection; its loopback WebSocket allowance exists
for the Vite development server. Deploy `dist/` to an HTTPS origin root. A
subpath deployment, host headers, deployment workflow, and rollback procedure
are not configured here.

## Tests and checks

Tests are colocated under `src/**/*.test.ts(x)` and run in Vitest's Node
environment. The production build uses TypeScript and Vite. Run `pnpm verify`
for the integrated local gate: lint, type-check, unit tests, and production
build. Browser, microphone hardware, codecs, deployment headers, and platform
behavior require separate runtime verification.
