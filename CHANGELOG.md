# Changelog

User-visible changes are listed here by release.

## Unreleased

### Changed

- Visual redesign ("engraved score"). Stages are numbered rehearsal marks;
  lesson identity, predictions, runs and model limits are labelled in a
  margin, as a score names its staves; the unrecorded preview is drawn in
  pencil (dashed graphite) and recorded runs in ink. Equations are typeset
  with italic variables, sub- and superscripts and Greek letters. The lesson
  index reads as a contents page. The app follows the system dark scheme, and
  presentation mode enlarges type for projection. Fonts are now Source Serif 4
  (regular, italic, semibold, Greek) and IBM Plex Mono; IBM Plex Sans is
  removed. Wording changes: the orient stage heading ("What you will find
  out"), the prediction lock note, "Limit of the model", and "Claims, limits
  and sources".
- Architecture reconstruction. Domains share one authoring API
  (`src/domains/support/`), and the ensemble domain has four source files.
  Lesson policy, such as which factors feed audio analysis, is declared on
  the lesson's factors through `audioSetting` instead of checking lesson
  identifiers. Evidence lives in `src/curriculum/evidence.ts`. The learning area
  has one persistence boundary under `src/learning/portfolio/` and one home per
  inquiry rule under `src/learning/inquiry/`. The app has a portfolio hook,
  structured inquiry messages, and typed fixtures. Import boundaries between
  layers are enforced by lint. Golden tests pin evaluator outputs and exported
  portfolio JSON. See [Architecture](docs/ARCHITECTURE.md).
- Tooling. ESLint 10 checks the whole repository. The supported Node range is
  `^20.19.0 || ^22.13.0 || >=24`. The bare test script is removed; use
  `pnpm test:unit`. `pnpm typecheck` covers the browser
  program and the Node-side configuration, and `pnpm build` no longer
  type-checks by itself. `pnpm verify` runs lint, typecheck, unit tests, and
  build.
- The hint for controlled comparison of recorded audio now reads "For recorded
  audio, compare a fresh analysis after changing only Onset threshold or
  Candidate family."
- Documentation keeps one home per topic: commands and verification in
  Contributing, structure and boundaries in Architecture.

### Removed

- Unused inquiry header, inspector action, lesson crumb, workflow panel, and
  workbench band style rules.

### Fixed

- `benchmarks/workbench.mjs` works again. It now opens the collapsed
  "Explore the model, charts and playback" section first.

## [0.1.0-alpha.1] - Unreleased

### Added

- 24 music mathematics lessons across eight domains, running in the browser.
- Optional microphone and audio-file analysis in three critique lessons.
- A learning portfolio saved in the browser, with direct links to lessons.
- An interactive Pages demo with example comparisons and storage separate
  from ordinary learning records. Deployment is manual.
- Migration of valid version 1 Ensemble Coupling Lab records into version 2
  lessons. Migration converts units, keeps the factors used by each lesson,
  and marks the trials with a legacy protocol identifier.

### Limitations

Compatibility and behavior may change during the alpha. Migration beyond the
current version 1 to version 2 copy is not guaranteed. Audio results are
uncalibrated observations and hypotheses; they do not assess performance or
provide complete transcription.
