# Scientific Audit: Musica Mathematica

Date: 2026-07-17
Status: unvalidated teaching workbench with explicit model, measurement, and
evidence boundaries

## Verdict

Musica Mathematica implements a structured undergraduate inquiry workbench for
mathematical representations of music. It provides reproducible calculations,
deterministic teaching models, bounded local signal features, and questions for
comparing those representations with listening and performing.

The project has not been evaluated in a classroom study. It is not a calibrated
acoustic or timing instrument, a definitive transcription system, a diagnostic
tool, or evidence that a student, performer, ensemble, or teaching intervention
is good, accurate, stable, or successful. Unit, integration, and browser tests
can establish software behavior; they cannot establish pedagogical efficacy,
perceptual validity, or ecological validity.

## Claim taxonomy

The application assigns each claim exactly one of the following seven kinds.

| Claim kind | Project meaning | Forbidden promotion |
| --- | --- | --- |
| `definition-or-theorem` | A mathematical identity follows from the displayed definitions for inputs inside their stated domain. | The identity predicts perception, preference, culture, or performance. |
| `computed-model-result` | The stated deterministic algorithm produced the value from the recorded inputs, seed, duration, and method. | The value is an observation of musicians, a room, or a network. |
| `measured-observation` | A local algorithm produced a descriptive feature from one bounded browser-audio segment. | The feature is calibrated SPL, clinical or diagnostic evidence, or a stable performer trait. |
| `transcription-hypothesis` | A lightweight estimator ranked possible tempo, meter, pitch, or chord labels. | The first label is ground truth or a complete polyphonic score. |
| `empirical-literature` | A study informs a question within its sampled population, task, material, and method. | The publication validates this app or makes its result universal. |
| `heuristic` | An explicitly identified proxy, multiplier, score, or interpretation band supports comparison. | The proxy is a validated perceptual, musical-quality, or deployment scale. |
| `recommendation` | The interface proposes another inquiry, listening, or rehearsal action. | The action is proven optimal or improves learning by itself. |

This taxonomy is an inference-control mechanism. It does not make a weak model
stronger; it makes the weakness visible.

## Ensemble model

### Canonical reference form

A common delayed networked Kuramoto form is:

```text
d theta_i / dt = omega_i
               + (K / d_i) sum_j A_ji sin(theta_j(t - tau_ji) - theta_i(t))
```

Here `theta_i` is oscillator phase, `omega_i` is natural angular frequency,
`A_ji` defines the interaction graph, `d_i` is an incoming-degree
normalization, `K` is coupling strength, and `tau_ji` is delay. This equation is
a mathematical reference family, not a literal theory of everything musicians
hear, intend, or do.

### Implemented equation

For oscillator `i`, the lesson evaluator runs eight model seconds with the
simulation function's default `0.01 s` integration step. The lower-level
function also accepts an explicit deterministic step size, while the exported
fixed-step driver uses `0.01 s`:

```text
d theta_i / dt = omega_i
  + [m_peer(texture) * rho_jitter / sqrt(d_i)]
      sum_(j -> i) K_ji sin(wrap(theta_j(t - tau_eff,ji(t)) - theta_i(t)))
  + C * m_click(texture)
      sin(wrap(Omega_click * t - theta_i(t)))
```

The implementation therefore differs materially from the canonical reference:

- it normalizes the incoming peer term by `sqrt(d_i)`, not by `d_i` or `N`;
- topology sets `K_ji`: all-to-all, leader–follower, or paired sections, with
  cross-section edges multiplied by `0.35`;
- repertoire texture changes natural-tempo spread, peer coupling, click
  coupling, the illustrative latency budget, and jitter reliability;
- effective delay adds deterministic, smoothly interpolated pseudo-jitter in
  `25 ms` control frames and clamps delay at zero;
- jitter also applies a separate heuristic reliability multiplier; and
- external click forcing is a separate sinusoidal term, not another peer.

The texture multipliers are published below because they are part of the
implemented result, but they are heuristics, not measurements fitted to
performer or repertoire data.

| Texture | Tempo spread | Peer | Click | Latency budget | Jitter penalty |
| --- | ---: | ---: | ---: | ---: | ---: |
| pulse | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| drone | 0.45 | 0.45 | 0.25 | 1.80 | 0.50 |
| call–response | 0.75 | 0.70 | 0.60 | 1.35 | 0.70 |
| rubato | 0.55 | 0.65 | 0.25 | 1.45 | 0.80 |
| dense rhythm | 1.25 | 1.20 | 1.25 | 0.62 | 1.70 |

For configured jitter `j` and delay `tau`, the reliability term is:

```text
rho_jitter = max(0.08,
                 1 - [j / max(tau, 0.01)]
                     * 1.35 * m_jitterPenalty(texture))
```

This deliberately compounds effective-delay variation with a reliability
penalty. It is useful for a stress-test lesson, but it is not an empirical model
of a specific audio codec, network, nervous system, or rehearsal.

### Ensemble observables

- The order parameter `r = |N^-1 sum_j exp(i theta_j)|` measures phase
  concentration inside this model. `r = 1` is phase alignment, not musical
  quality.
- Circular phase spread is the root-mean-square shortest angular distance from
  the model mean phase.
- `phaseSpreadEquivalentMs` divides simulated angular spread by the current
  mean natural angular frequency. It is a period-equivalent conversion, not a
  measured onset error or route latency.
- Leader-to-follower lag and section coherences are graph-specific computed
  values and appear only when their graph makes them meaningful.
- Peer-coupling share is `K / (K + C)` after non-negative clamping. It describes
  configured strengths, not the fraction of human attention assigned to peers.

The illustrative phase budget begins with `pi / (2 omega)`, equivalent to
`15 / BPM` seconds, and multiplies it by the texture budget above. The labels
are `plausible` below a delay/budget ratio of `0.55`, `fragile` from `0.55`, and
`unstable` from `0.85`. These bands are transparent teaching heuristics. They
must not be quoted as universal mouth-to-ear limits or deployment acceptance
criteria.

### Omitted phenomena

The phase-only model omits score hierarchy, expressive timing, onset shape,
instrument attack, room acoustics, visual and bodily cues, attention,
prediction, expertise, social roles, individual adaptation rules, hearing and
monitoring differences, packet loss, codec behavior, audio quality, and
audiovisual skew. Those omissions are central when transferring a model result
to joint music making.

## Other mathematical domains

The remaining seven domains also separate exact mathematics from musical
interpretation:

- BPM/period conversion, greatest common divisors, least common multiples,
  wrapped phase, logarithmic cents, modular pitch classes, seeded probability,
  Markov transitions, entropy, and quantiles are exact only under their stated
  definitions.
- Euclidean patterns, onset autocorrelation, discrete spectra, Tonnetz paths,
  voice-leading assignment distances, equal-division approximation, partial
  coincidence, roughness, resonance, and spectral-centroid trajectories are
  selected representations. None is a complete account of rhythm, harmony,
  tuning, consonance, timbre, or form.
- Seeded sequences make chance lessons reproducible; a finite realization is
  not the same thing as its generating distribution.
- Median inter-onset interval is a transparent tempo estimator that can fail
  under subdivisions, missing events, tempo change, expressive timing, and
  onset-detector error.
- Signed event differences, median, and interquartile range preserve direction
  and spread. The app intentionally defines no target, score, grade, accuracy
  class, or better/worse label.

## Local audio and measurement status

Microphone and file inputs are optional and browser-local. Microphone frames
move through a credit-bounded `AudioWorklet` and local Web Worker path. Bounded
file selections transfer directly to a local Web Worker. Raw PCM is transient
in both paths and is not written to the learning portfolio or app export. Queue
overflow, stale frames, and sequence gaps are surfaced rather than hidden.
File and microphone limits, settings, and data flow are documented in
[LOCAL_AUDIO_METHOD.md](docs/LOCAL_AUDIO_METHOD.md).

All audio-derived values are `uncalibrated`:

- dBFS describes digital amplitude relative to full scale; it is not sound
  pressure level;
- the noise-floor value is a low-percentile block-RMS estimate, not a calibrated
  room-noise measurement;
- clipping and silence indicators depend on explicit numerical thresholds;
- YIN pitch is a monophonic periodicity estimate with confidence, not a note
  oracle;
- spectral flux proposes onsets; autocorrelation proposes tempo; repeated
  accent agreement proposes meter; and chroma-template similarity proposes up
  to three major, minor, or no-chord labels;
- no full polyphonic transcription, source separation, score alignment, SPL
  calibration, or latency calibration is implemented.

Recorded audio is marked non-deterministic. Only the Recorded-Onset Hypotheses
lesson admits audio-derived A/B snapshots, and only when a fresh analysis changes
one exposed analysis setting while source and frame settings remain constant.
Chord and time-varying-timbre audio views are observation appendices rather than
causal portfolio comparisons.

The W3C specifications define browser interfaces and browser constraint
behavior. They do not validate this project's feature algorithms or musical
interpretations.

## Pedagogical status and research rationale

The plan–experiment–compare–explain–perform–transfer workflow, layered lesson
sequence, explicit source cards, and requirement to state inference limits are
evidence-informed design decisions. The cited work motivates those decisions as
follows:

- [Zhu et al. (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12637912/)
  evaluated a structured flipped module in one undergraduate music-theory
  context. Its quasi-experimental result supports investigating aligned
  preparation, collaboration, and reflection; it does not establish that this
  workbench will reproduce those outcomes.
- [Wang et al. (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12734040/)
  reviewed 31 metacognition and self-regulated-learning intervention studies in
  music, with seven in its meta-analysis. Its plan–practice–reflection framing
  motivates explicit prediction, comparison, and reflection, while its study
  heterogeneity argues against assuming a universal effect.
- [Azaryahu, Ariel, and Leikin (2024)](https://www.nature.com/articles/s41599-024-03631-z)
  reported qualitative perspectives from 16 music, mathematics, and education
  experts. Their emphasis on structure, representation, creativity, and
  disciplinary expertise supports an integrated curriculum; the small,
  context-specific interview study is not an efficacy trial.
- [Jacoby et al. (2024)](https://www.nature.com/articles/s41562-023-01800-9)
  found both common small-integer-ratio structure and substantial variation in
  rhythm priors across 39 participant groups in 15 countries. That result
  motivates showing alternatives and resisting a single culturally universal
  meter interpretation.
- [Marjieh et al. (2024)](https://www.nature.com/articles/s41467-024-45812-z)
  showed in large-scale behavioral studies that timbral manipulations can
  reshape consonance preferences. It motivates the timbre–consonance lesson but
  does not calibrate the app's partial-coincidence or roughness proxies.
- [Snyder, Gordon, and Hannon (2024)](https://www.nature.com/articles/s44159-024-00315-y)
  review behavioral, neural, oscillator, and predictive accounts of rhythm,
  beat, and metre. The coexistence of distinct models motivates comparing
  representations rather than presenting one onset vector as perception.
- [Frederick (2023/2024)](https://doi.org/10.1093/mts/mtad017) constructs an
  abstract diatonic voice-leading transformation space and interprets it as an
  instrumental space. It provides music-theory context for geometric and
  transformational inquiry, not validation of this app's simplified graph or
  assignment metric.
- [Demos and Palmer (2023)](https://doi.org/10.1016/j.tics.2023.05.005) connect
  nonlinear and social dynamics in musical group synchrony. Their argument for
  emergent group properties cautions against reducing ensemble interaction to
  independent pairwise phase links.
- [Abalde et al. (2024)](https://doi.org/10.1016/j.neubiorev.2024.105816) frame
  joint music making around coordination together with knowledge, goals,
  strategies, and social factors. Those components mark important omissions
  from the simulator.
- The [W3C Web Audio API](https://www.w3.org/TR/webaudio/) specifies the
  `AudioWorklet` processing interface used by the capture path, and
  [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
  specifies permission, tracks, constraints, and reported settings used by the
  microphone path.

Publication metadata and findings were checked on 2026-07-24. Research evolves;
instructors should re-check sources before treating this list as a current
literature review.

## Responsible teaching use

Use a result to ask a better question: which variables were held constant,
which representation generated the display, what source or method supports the
claim, and what listening, score study, performance, or external measurement
could challenge it? Retain musical and cultural judgment. Do not use the app's
portfolio as an automatic grade or its outputs as evidence of accreditation,
classroom effectiveness, performer ability, ensemble quality, or network
readiness.
