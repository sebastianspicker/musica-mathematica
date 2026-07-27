# Musica Mathematica Curriculum

Status: implemented curriculum

Audience: undergraduate university and conservatoire music students

Language: English

## Purpose

Musica Mathematica treats mathematics as a way to construct, inspect, and
criticize musical representations. It is not a sequence of formula drills and
does not assume that a numerical result settles a question of perception,
culture, interpretation, or performance.

The curriculum contains 24 lessons in eight domains. Within every domain,
students encounter three layers:

1. `Foundation`: establish notation, units, and exact definitions;
2. `Model`: combine definitions into a reproducible representation or
   simulation; and
3. `Critique`: test the representation against ambiguity, measured sound,
   musical context, or an omitted mechanism.

This progression is intended to support students with different mathematical
backgrounds while still reaching undergraduate topics such as circular
variables, delayed nonlinear dynamics, discrete spectra, logarithmic tuning,
modular and graph spaces, Fourier analysis, Markov chains, information theory,
quantile summaries, and estimator bias.

## Curriculum-wide learning outcomes

After completing a substantial selection of the lessons, a student should be
able to:

- translate between a musical question and explicit variables, units,
  assumptions, and mathematical operations;
- distinguish an identity, model output, observation, transcription
  hypothesis, literature claim, heuristic, and recommendation;
- calculate and interpret tempo–period relations, integer return times,
  circular phase, cents, equal divisions, modular pitch classes, probability,
  entropy, and descriptive statistics;
- reason about delayed oscillator coupling, topology, external forcing,
  autocorrelation, spectra, graph distance, resonance, sampling, aliasing,
  Markov memory, and parameter recovery;
- record a prediction before changing a factor and use a controlled A/B
  comparison to support or revise an explanation;
- identify what a mathematical representation preserves and what it discards;
- interpret locally derived audio features as bounded, uncalibrated
  observations or ranked hypotheses; and
- propose a score-based, listening, performance, or measurement task that could
  challenge a model-derived conclusion.

These are intended learning outcomes, not measured outcomes of this software.
The project has no accreditation or classroom-validation claim.

## Lesson protocol

All lessons use the same eight-stage inquiry record.

| Stage | Learner action | Evidence purpose |
| --- | --- | --- |
| Orient | Read the question, equation, factors, and claim labels. | Establish the representation and its boundary. |
| Predict | Commit to a directional or comparative expectation. | Make prior reasoning visible before observing output. |
| Experiment | Record controlled trials, normally changing one factor. | Create reproducible evidence rather than an untracked demonstration. |
| Compare | Inspect at least two normalized trial snapshots. | Separate changed factors from observed changes. |
| Explain | Connect the difference to a mechanism or definition. | Require a warranted inference rather than a visual impression. |
| Perform | Test or discuss the idea through playing, singing, tapping, listening, or score study. | Reconnect the abstraction to musicianship. |
| Transfer | Apply the representation in a new repertoire or analytic context. | Probe whether the reasoning travels. |
| Debrief | State limits, alternatives, and next evidence needed. | Prevent the model from becoming an automatic conclusion. |

The browser enforces the ordering needed for a useful record: a prediction is
required before experiment; at least two trials are required before comparison
and explanation; later reflection stages require written responses. This is
formative scaffolding, not automatic assessment.

## Domain 1: Phase & Proportion

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| From BPM to Period | Foundation | Use `T = 60 / b`; invert the relation; carry seconds, beats, and bars through calculations. | Relate score tempo to nominal duration without claiming that a performer realizes an exact clock. |
| Polyrhythm Return Times | Model | Use greatest common divisors and `lcm(p,q) = |pq| / gcd(p,q)` to find exact integer-lattice returns. | Separate exact pulse realignment from accent, groove, grouping, and perceived beat. |
| Phase on the Circle | Critique | Compute wrapped phase and shortest signed circular difference; reason modulo one cycle. | Identify timing, articulation, cueing, and hierarchy that a single phase variable omits. |

Suggested performance task: layer two pulse cycles, mark the mathematical
return, then change accent or articulation without changing the onset lattice.

## Domain 2: Ensemble Dynamics

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Lock-In and Order | Foundation | Explore natural-frequency spread, coupling, and the Kuramoto order parameter `r = |N^-1 sum exp(i theta_j)|`. | Interpret phase concentration as a model property, never as ensemble quality. |
| Delay, Jitter, and Topology | Model | Compare delayed coupling graphs, square-root degree normalization, deterministic pseudo-jitter, and terminal phase statistics. | Distinguish a configured model stressor from an observation of a rehearsal or network route. |
| External Pulse or Peer Adaptation | Critique | Compare peer coupling with separate sinusoidal forcing and inspect configured peer share. | Choose a musical criterion before discussing click or peer-led strategies; no strategy is declared universally better. |

The Ensemble Coupling Lab compatibility schema contains seven scenarios that
map into these three lessons. Its identifiers migrate into the v2 portfolio,
while the phase-only simulator and its public configuration contract remain the
model core. The exact implemented equation and heuristic multipliers are
published in [the scientific audit](../SCIENTIFIC_AUDIT.md#ensemble-model).

Suggested performance task: rehearse a short passage with two reversible cueing
policies, then compare musical criteria selected before the trial. Do not use
the simulator's latency bands as a network acceptance test.

## Domain 3: Rhythm & Meter

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Cycles and Euclidean Rhythm | Foundation | Distribute binary onsets over a cycle and rotate the result; distinguish density, interval pattern, and origin. | Treat downbeat and accent as musical choices not fixed by cyclic equivalence. |
| Autocorrelation, Spectrum, and Meter | Model | Calculate circular autocorrelation, a discrete spectrum, and ranked equal-subdivision alignment. | A periodicity or high score is not a listener's definitive metre. |
| Recorded-Onset Hypotheses | Critique | Use positive spectral flux, peak selection, and ranked tempo and meter candidates. | Compare alternatives with listening, tapping, and score evidence; input-derived events remain hypotheses. |

[Jacoby et al. (2024)](https://www.nature.com/articles/s41562-023-01800-9)
reported both small-integer-ratio commonalities and variation reflecting local
musical practice across 39 groups in 15 countries. The lesson therefore asks
students to compare representations instead of treating one metrical grid as
culturally universal. [Snyder, Gordon, and Hannon (2024)](https://www.nature.com/articles/s44159-024-00315-y)
review multiple behavioral, neural, oscillator, and predictive accounts of
rhythm, beat, and metre, further motivating model comparison.

## Domain 4: Pitch & Tuning

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Ratios, Logs, and Cents | Foundation | Convert frequency ratios with `c = 1200 log2(f2/f1)` and recover target frequencies from a reference. | Exact arithmetic does not define preferred intonation or tuning practice. |
| Temperaments and Commas | Model | Approximate a ratio in an `m`-EDO lattice; calculate nearest step, signed cents error, and idealized beating. | Smaller numerical error for one ratio does not establish the best temperament for repertoire. |
| Timbre Changes Consonance | Critique | Construct harmonic partial spectra and compare transparent coincidence and roughness proxies. | Discuss timbre-dependent experience without scoring consonance or universalizing preference. |

[Marjieh et al. (2024)](https://www.nature.com/articles/s41467-024-45812-z)
found that timbral manipulation can reshape consonance preferences. This
motivates holding interval constant while changing spectra; it does not
calibrate the lesson's simplified proxies.

## Domain 5: Harmony & Geometry

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Pitch-Class Symmetry | Foundation | Normalize modulo 12; calculate interval-class structure; apply transposition and inversion. | Set equivalence does not preserve register, voicing, spelling, function, or syntax. |
| Tonnetz and Voice-Leading | Model | Compute a minimum voice assignment and an illustrative shortest path through a triadic graph. | A short path under one metric does not prove tonal function or perceptual proximity. |
| Chord Hypotheses | Critique | Compare chroma with major, minor, and no-chord templates using cosine similarity; inspect the top three. | Rankings omit voicing, inversion, function, non-triadic harmony, and complete score context. |

[Frederick (2023/2024)](https://doi.org/10.1093/mts/mtad017) demonstrates how
an abstract diatonic voice-leading space can be interpreted as an instrumental
space. It supplies scholarly context for relating algebra, geometry, and
embodied chord shapes, while the app's smaller graph and assignment metric
remain teaching representations.

## Domain 6: Timbre & Acoustics

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Resonance, Modes, and Partials | Foundation | Use `f_n = n v / (2L)` for ideal fixed-string modes and construct an additive partial series. | Name stiffness, damping, radiation, excitation, and geometry omitted from the ideal string. |
| Fourier, Windows, and Aliasing | Model | Relate `Delta f = f_s/N`, frame duration, Hann windowing, Nyquist frequency, and folded aliases. | A plotted bin is finite-resolution evidence affected by leakage and the chosen window. |
| Time-Varying Timbre | Critique | Model amplitude envelopes and changing partial weights; inspect a spectral-centroid trajectory or local audio features. | One spectrum cannot represent an evolving sound, and one feature cannot define timbre. |

Suggested performance task: record or synthesize two articulations of one pitch,
compare a time-varying feature, and then write what attentive listening adds or
contradicts. The raw sound must remain outside the portfolio.

## Domain 7: Probability & Form

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Seeded Chance | Foundation | Generate a reproducible Bernoulli sequence; compare declared and finite observed proportions. | One finite realization neither proves nor refutes its generating probability. |
| Markov Memory | Model | Read and apply a two-state transition matrix; generate a seeded chain; compare empirical and stationary proportions. | A first-order state model omits longer memory, hierarchy, intention, and listening history. |
| Entropy, Surprisal, and Form | Critique | Calculate binary entropy and event information `-log2 p`; compare theory with a finite sequence. | Statistical uncertainty and rarity are not aesthetic value, formal function, or listener surprise. |

Suggested composition task: create two seeded realizations from the same model,
then identify formal features that the transition probabilities fail to encode.

## Domain 8: Measurement & Inference

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Provenance and Uncertainty | Foundation | Summarize a deterministic sample with mean, median, sample standard deviation, type-7 quartiles, IQR, and an approximate 95% mean interval. | Every number must retain source, unit, method, sample count, and calibration status. |
| Recovering Parameters | Model | Estimate BPM from the median inter-onset interval and calculate signed recovery error for synthetic known-truth fixtures. | Subdivision, missing events, timing change, and onset errors can make a plausible estimate wrong. |
| Compare Without Grading | Critique | Pair event sets; calculate signed differences, median, quartiles, and IQR. | Describe earlier/later and spread without defining a target, quality score, grade, or better/worse verdict. |

This domain supplies a common critical vocabulary for the other seven. Students
should be asked whether a value is a known generating parameter, a model result,
an observation, or an estimator of something unavailable.

## Local audio lessons

Only three critique lessons expose microphone and file modes:

- Recorded-Onset Hypotheses
- Chord Hypotheses
- Time-Varying Timbre

Synthetic mode is always available. Microphone and file work is optional and
must follow [the local audio method](LOCAL_AUDIO_METHOD.md). Derived features can
support listening and comparison, but no audio label becomes a grade or a
definitive transcription.

Only Recorded-Onset Hypotheses uses recorded audio in a portfolio A/B: learners
reanalyze a fresh bounded segment after changing onset threshold or candidate
family while holding source and frame settings constant. Chord Hypotheses and
Time-Varying Timbre use recorded audio as observation appendices; their
controlled portfolio comparisons remain synthetic because the displayed
synthetic factors do not control incoming sound.

## Teaching formats

These are recommendations to test and adapt, not validated delivery schedules.

### Full 24-session sequence

Use one lesson per 60–90 minute session. Teach each three-lesson domain as a
foundation–model–critique arc. This pattern gives time for a prediction, two
trials, performance or listening transfer, and debrief in every meeting.

### Twelve-week seminar

Pair lessons in some weeks and reserve four sessions for critique lessons using
student-chosen repertoire. Require students to identify the evidence kind and
one omitted mechanism in every submission. Use the portfolio as a source of
artifacts, then assess reasoning with a separate instructor-authored rubric.

### Embedded sampler

Select one foundation, one model, and one critique lesson that serve an existing
course topic. For example, a theory course might combine Ratios, Logs, and Cents;
Tonnetz and Voice-Leading; and Timbre Changes Consonance. An ensemble seminar
might combine From BPM to Period; Delay, Jitter, and Topology; and Compare
Without Grading.

## Instructor practice

Before class, choose the musical question and decide which factors students may
change. During class, require predictions before revealing comparisons and ask
students to name each claim kind aloud. After class, ask for one model-supported
statement, one unsupported inference, and one next observation or performance
test.

The app's presentation mode supports projection. The current alpha working tree
does not provide course authoring, accounts, roster views, LMS exchange, remote
monitoring, automatic scoring, or gradebook integration. Portfolio JSON may be
exported by the learner, but interpretation and any formal assessment remain
outside the app.

## Why the pedagogy is evidence-informed, not validated

[Zhu et al. (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12637912/) provide
one recent undergraduate music-theory example of structured preparation,
collaboration, and reflection. [Wang et al. (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12734040/)
review 31 interventions in music metacognition and self-regulated learning and
identify plan–practice–reflection, explicit strategy, technological feedback,
and teacher support as recurring mechanisms. [Azaryahu, Ariel, and Leikin
(2024)](https://www.nature.com/articles/s41599-024-03631-z) show that experts
connect music and mathematics through structure, representation, creativity,
and learning opportunities while also emphasizing the expertise needed to
integrate the disciplines.

Those sources motivate aligned tasks, explicit predictions, controlled
comparisons, reflection, and instructor mediation. They do not evaluate Musica
Mathematica, its 24 lessons, or its portfolio. A future validation study would
need preregistered outcomes, suitable comparison conditions, representative
students and repertoire, implementation-fidelity evidence, accessibility
reporting, and analysis that distinguishes software effects from instructor and
course-design effects.

## Language and accessibility boundary

The current lesson content is English-only. Stable domain and lesson identifiers
are separate from display titles, which reduces future migration risk, but no
translation catalog, locale switcher, or translated curriculum is implemented.
The interface uses semantic controls, visible focus, responsive layouts,
reduced-motion support, opt-in audio, and a presentation view. These are
accessibility-oriented implementation choices, not a formal conformance claim.
