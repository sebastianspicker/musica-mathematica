# Curriculum guide

Musica Mathematica contains 24 lessons for undergraduate music students at
universities and conservatoires. Each lesson connects a musical question to a
mathematical representation, then asks students what that representation
explains and what it leaves out. The current lesson content is in English.

## How the lessons fit together

Each of the eight domains has three levels:

1. Foundation introduces the notation, units, and definitions.
2. Model uses those definitions in a reproducible calculation or simulation.
3. Critique examines ambiguity, recorded sound, musical context, or a missing
   part of the model.

Students can start with the foundations and work toward circular variables,
delayed dynamics, spectra, logarithmic tuning, graphs, Markov chains,
information theory, and statistical estimation. A numerical result is one
part of that work. Listening, cultural context, interpretation, and performance
still require musical judgment.

## Learning aims

The lessons ask students to:

- turn a musical question into variables, units, assumptions, and operations;
- distinguish definitions, model results, observations, hypotheses, research
  findings, heuristics, and recommendations;
- calculate tempo and period, pulse return times, phase, cents, pitch classes,
  probabilities, entropy, and descriptive statistics;
- explain how coupling, delay, topology, spectra, sampling, resonance, graph
  distance, Markov memory, and estimation affect a result;
- use a prediction and a controlled comparison to support or revise an
  explanation;
- identify what a representation preserves and omits;
- interpret audio features as uncalibrated observations or ranked hypotheses;
- propose a listening, score-study, performance, or measurement task that
  could challenge a conclusion.

These are teaching aims. The project has not measured whether students achieve
them or sought accreditation for the curriculum.

## Working through a lesson

Every lesson follows the same eight stages.

| Stage | What the student does |
| --- | --- |
| Orient | Read the question, equation, factors, and evidence labels. Identify the model's assumptions. |
| Predict | Write what should change and why, before viewing results. |
| Experiment | Record trials with one changed factor. |
| Compare | Examine the inputs and observations from the two latest runs. |
| Explain | Connect the difference to a definition or mechanism. |
| Perform | Try or discuss the idea through playing, singing, tapping, listening, or score study. |
| Transfer | Apply the reasoning to another piece or musical situation. |
| Debrief | State the limits, alternatives, and evidence still needed. |

The app requires a prediction before an experiment and at least two trials
before comparison and explanation. Later stages require written responses.
These checks help students keep a complete record; they do not assess the
quality of their reasoning.

## Domain 1: Phase & Proportion

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| From BPM to Period | Foundation | Use `T = 60 / b`; invert the relation; carry seconds, beats, and bars through calculations. | Relate score tempo to nominal duration without claiming that a performer realizes an exact clock. |
| Polyrhythm Return Times | Model | Use greatest common divisors and `lcm(p,q) = \|pq\| / gcd(p,q)` to find exact integer-lattice returns. | Separate exact pulse realignment from accent, groove, grouping, and perceived beat. |
| Phase on the Circle | Critique | Compute wrapped phase and shortest signed circular difference; reason modulo one cycle. | Identify timing, articulation, cueing, and hierarchy that a single phase variable omits. |

Suggested performance task: layer two pulse cycles, mark the mathematical
return, then change accent or articulation without changing the onset lattice.

## Domain 2: Ensemble Dynamics

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Lock-In and Order | Foundation | Explore natural-frequency spread, coupling, and the Kuramoto order parameter `r = \|N^-1 sum exp(i theta_j)\|`. | Interpret phase concentration as a model property, never as ensemble quality. |
| Delay, Jitter, and Topology | Model | Compare delayed coupling graphs, square-root degree normalization, deterministic pseudo-jitter, and terminal phase statistics. | Distinguish a configured model stressor from an observation of a rehearsal or network route. |
| External Pulse or Peer Adaptation | Critique | Compare peer coupling with separate sinusoidal forcing and inspect configured peer share. | Choose a musical criterion before discussing click or peer-led strategies; no strategy is declared universally better. |

Older Ensemble Coupling Lab records use seven scenario identifiers, which map
to these three lessons when copied into a version 2 portfolio. Migrated trials
retain a separate legacy protocol identifier. See the
[scientific basis](SCIENTIFIC_BASIS.md#ensemble-model) for the implemented
simulation equation and its heuristic multipliers.

Suggested performance task: choose musical criteria, then rehearse a short
passage with two cueing approaches and compare what you hear. The simulator's
latency bands cannot tell you whether a real network is suitable for rehearsal.

## Domain 3: Rhythm & Meter

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Cycles and Euclidean Rhythm | Foundation | Distribute binary onsets over a cycle and rotate the result; distinguish density, interval pattern, and origin. | Treat downbeat and accent as musical choices not fixed by cyclic equivalence. |
| Autocorrelation, Spectrum, and Meter | Model | Calculate circular autocorrelation, a discrete spectrum, and ranked equal-subdivision alignment. | A periodicity or high score is not a listener's definitive metre. |
| Recorded-Onset Hypotheses | Critique | Use positive spectral flux, peak selection, and ranked tempo and meter candidates. | Compare alternatives with listening, tapping, and score evidence; input-derived events remain hypotheses. |

[Jacoby et al. (2024)](https://www.nature.com/articles/s41562-023-01800-9)
found shared preferences for integer-ratio rhythms alongside variation linked
to local musical traditions across 39 groups in 15 countries. Students can use
this finding to question whether one metrical grid describes every listener. [Snyder, Gordon, and Hannon (2024)](https://www.nature.com/articles/s44159-024-00315-y)
review behavioral, neural, oscillator, and predictive accounts of rhythm, beat,
and metre. The different accounts give students reasons to compare models.

## Domain 4: Pitch & Tuning

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Ratios, Logs, and Cents | Foundation | Convert frequency ratios with `c = 1200 log2(f2/f1)` and recover target frequencies from a reference. | Exact arithmetic does not define preferred intonation or tuning practice. |
| Temperaments and Commas | Model | Approximate a ratio in an `m`-EDO lattice; calculate nearest step, signed cents error, and idealized beating. | Smaller numerical error for one ratio does not establish the best temperament for repertoire. |
| Timbre Changes Consonance | Critique | Construct harmonic partial spectra and compare transparent coincidence and roughness proxies. | Discuss timbre-dependent experience without scoring consonance or universalizing preference. |

[Marjieh et al. (2024)](https://www.nature.com/articles/s41467-024-45812-z)
found that changing timbre can reshape consonance preferences. In this lesson,
students hold the interval constant and change the spectrum. The study informs
that question; it does not calibrate the app's coincidence or roughness proxies.

## Domain 5: Harmony & Geometry

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Pitch-Class Symmetry | Foundation | Normalize modulo 12; calculate interval-class structure; apply transposition and inversion. | Set equivalence does not preserve register, voicing, spelling, function, or syntax. |
| Tonnetz and Voice-Leading | Model | Compute a minimum voice assignment and an illustrative shortest path through a triadic graph. | A short path under one metric does not prove tonal function or perceptual proximity. |
| Chord Hypotheses | Critique | Compare chroma with major, minor, and no-chord templates using cosine similarity; inspect the top three. | Rankings omit voicing, inversion, function, non-triadic harmony, and complete score context. |

[Frederick (2024, published online in 2023)](https://doi.org/10.1093/mts/mtad017)
relates an abstract diatonic voice-leading space to the keyboard. The paper
connects algebra and geometry to physical chord shapes. The app uses a smaller
teaching graph and its own assignment metric.

## Domain 6: Timbre & Acoustics

| Lesson | Level | Mathematical work | Musical inquiry and boundary |
| --- | --- | --- | --- |
| Resonance, Modes, and Partials | Foundation | Use `f_n = n v / (2L)` for ideal fixed-string modes and construct an additive partial series. | Name stiffness, damping, radiation, excitation, and geometry omitted from the ideal string. |
| Fourier, Windows, and Aliasing | Model | Relate `Delta f = f_s/N`, frame duration, Hann windowing, Nyquist frequency, and folded aliases. | A plotted bin is finite-resolution evidence affected by leakage and the chosen window. |
| Time-Varying Timbre | Critique | Model amplitude envelopes and changing partial weights; inspect a spectral-centroid trajectory or local audio features. | One spectrum cannot represent an evolving sound, and one feature cannot define timbre. |

Suggested performance task: record or synthesize two articulations of one pitch,
compare a time-varying feature, and then write what attentive listening adds or
contradicts. Keep the audio itself outside the portfolio.

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

Use this domain to revisit results from the other seven: is a number a known
input, a model result, an observation, or an estimate of something you cannot
observe directly?

## Lessons with audio input

Three critique lessons offer optional microphone and file input:

- Recorded-Onset Hypotheses
- Chord Hypotheses
- Time-Varying Timbre

Every lesson also works with synthetic input. See the
[audio guide](LOCAL_AUDIO_METHOD.md) for recording limits and processing
methods. Audio features can help students compare what they hear, but the
labels are neither grades nor definitive transcriptions.

Recorded-Onset Hypotheses can save audio-derived A/B comparisons. Students
change the onset threshold or candidate family, run a fresh analysis, and
hold the source and frame settings constant. In Chord Hypotheses and
Time-Varying Timbre, recorded audio provides additional observations. Their
portfolio comparisons use synthetic input because the model's factors do not
control the incoming sound.

## Teaching formats

These are starting points to adapt to a course, not tested delivery schedules.

### One lesson per session

Allow 60–90 minutes for each of the 24 lessons. Work through each domain's
foundation, model, and critique lessons in order, leaving time for a
prediction, two trials, listening or performance, and reflection.

### Twelve-week seminar

Select and pair lessons to suit the available sessions, reserving four
sessions for critique with repertoire chosen by students. Ask students to
identify the evidence type and one missing mechanism in each submission.
Their portfolios can supply examples for assessment with a separate rubric
written by the instructor.

### A short sequence within another course

Choose a foundation, model, and critique lesson that fit the course topic.
For a theory course, try Ratios, Logs, and Cents; Tonnetz and Voice-Leading;
and Timbre Changes Consonance. For an ensemble seminar, try From BPM to
Period; Delay, Jitter, and Topology; and Compare Without Grading.

## Before, during, and after class

Before class, choose the musical question and the factors students will change.
During the lesson, ask for predictions before results and discuss what kind of
evidence each result provides. Afterwards, ask students for one conclusion the
model supports, one it does not, and a next step involving observation or
performance.

Presentation mode supports projection. Learners can export their portfolios as
JSON, but the app has no course authoring, accounts, rosters, LMS exchange,
remote monitoring, automatic scoring, or gradebook integration. Assessment
remains the instructor's responsibility.

## Research behind the teaching approach

[Zhu et al. (2025)](https://doi.org/10.1371/journal.pone.0337590) studied a flipped
music-theory module with structured preparation, collaboration, and reflection
in one undergraduate setting. [Wang et al. (2025)](https://www.mdpi.com/2079-3200/13/12/162)
reviewed 31 music metacognition and self-regulated learning studies, including
seven in a meta-analysis. They identified structured learning support, strategy
teaching, technology, and teacher support as recurring themes.

[Azaryahu, Ariel, and Leikin (2024)](https://www.nature.com/articles/s41599-024-03631-z)
interviewed 16 experts about connections between music and mathematics. Their
responses emphasized shared structure, aesthetics, creativity, and learning
opportunities, as well as the disciplinary expertise needed to bring them
together.

These studies helped shape the prediction, comparison, reflection, and teaching
activities. None evaluated Musica Mathematica or its lessons. Testing the app's
educational effects would require preregistered outcomes, suitable comparison
conditions, representative students and repertoire, checks on how lessons were
taught, and accessibility reporting. The study would also need to distinguish
the software's effects from those of the teacher and course design. The
[scientific basis](SCIENTIFIC_BASIS.md#pedagogical-status-and-research-rationale)
provides more detail on the studies and their limits.

## Language and accessibility

Lessons are in English. Display titles are separate from the stable domain and
lesson identifiers, but there is no translation catalog, language switcher, or
translated curriculum.

The interface provides semantic controls, visible keyboard focus, responsive
layouts, reduced-motion support, optional audio, and presentation mode. These
features have not been assessed for formal accessibility conformance.
