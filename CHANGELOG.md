# Changelog

User-visible changes are listed here by release.

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
- The built app ships a stricter Content Security Policy: inline styles and
  loopback WebSocket connections are allowed only by the development server.
- The setup instructions explain how to install pnpm 11.6.0 when Corepack is
  not available (Node.js 25 and later).

### Removed

- Unused inquiry header, inspector action, lesson crumb, workflow panel, and
  workbench band style rules.
- The audio worker's never-filling frame queue and its always-zero overflow
  count, and the unused `workerModuleUrl` worker option.

### Fixed

- `benchmarks/workbench.mjs` works again. It now opens the collapsed
  "Explore the model, charts and playback" section first.
- File-based audio analysis keeps the chosen file after a factor change or a
  completed analysis, so a controlled comparison can analyze the same file for
  Run A and Run B without choosing it again. Switching between microphone and
  file input still clears the selection.
- Two open tabs no longer overwrite each other's lessons. A tab reloads the
  portfolio when another tab saves it.
- Saved learning data that cannot be read is no longer replaced silently. The
  app keeps a copy in the browser, says so, and starts a new portfolio; if no
  copy can be kept, automatic saving stays off. An unknown active lesson, for
  example after a rollback, no longer discards the other lessons.
- Run labels keep counting after the 12-run limit instead of repeating
  "Run 13".
- Autocorrelation, Spectrum, and Meter reports the same strongest spectral bin
  for every rotation of a rhythm.
- Phase on the Circle no longer shows a phase of 1.000 cycles.
- Recorded-Onset Hypotheses counts the plotted candidate onsets at or above the
  threshold; a high threshold can now leave none.
- Synthetic results in Measurement & Inference no longer cite the claim for
  locally measured audio or transcription hypotheses.
- Measurement & Inference fixtures use the same seeded generator as
  Probability & Form, so neighbouring seeds give clearly different samples.
- Entropy, Surprisal, and Form generates its sequence from the recorded seed.
- The ensemble model reads delayed states at exact 10 ms multiples reliably,
  and its final-state values are labelled as instantaneous.
- The pulses help text states that values above the cycle length are capped,
  and the whole-tone option is labelled as a tetrachord.
- The audio-analysis timeout message states the configured limit.
- A 30-second audio-file selection is no longer rejected as too long when its
  start time is fractional.
- Saved text cut at the length limit on a space no longer stops the app from
  opening.
- When a load would drop saved lessons and no copy can be kept, the original
  stays untouched and automatic saving stays off. Older saved data that cannot
  be converted is reported instead of being ignored silently.
- A microphone that disconnects during capture ends the segment with a notice.
  A silent frame reads "Silent frame" instead of "-Infinity dBFS".
- Euclidean onset patterns are no longer split into a value and a unit in the
  result heading.
- Portfolio export keeps the download link valid until the browser has started
  the download.
- An unreadable lesson attempt no longer hides the other saved lessons; it is
  left out on its own and a copy of the original is kept.
- If the app cannot start, it shows a recovery screen to download the saved
  data or, after confirmation, clear local work.
- A recorded selection with two notes reports a pitch that was played, not the
  average of both.
- Audio files are decoded at a fixed 44.1 kHz, so results no longer depend on
  the output device.
- Meter candidates need at least two steps per beat, and their score is
  corrected for chance alignment. A flat spectrum reports "no" strongest bin.
- Chord scores are labelled as an illustrative teaching fixture, not template
  similarity, and cite the transparent-heuristic claim.
- Recorded-onset tempo candidates are described as constructed with the input
  tempo first, not as a ranking.
- The Markov lesson notes that a symmetric chain is stationary at 50/50, and
  the stationary-distribution precondition is documented.
- The scientific basis documents the delay hold, jitter clipping and start-up
  behaviour of the ensemble model.
- The ensemble simulation samples the initial state at t = 0.
- The Hann window is drawn on a normalized, periodic frame axis.
- The timbre trajectory uses enough points to avoid aliasing fast modulation.
- Removed the constant "Vector invariant" and "Exact realignment" observables.

### Limitations

Compatibility and behavior may change during the alpha. Migration beyond the
current version 1 to version 2 copy is not guaranteed. Audio results are
uncalibrated observations and hypotheses; they do not assess performance or
provide complete transcription.
