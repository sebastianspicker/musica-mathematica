# Scientific basis

Musica Mathematica uses calculations, simulations, and short audio analyses to
explore musical questions. This guide explains the implemented models, the
research behind the lesson design, and the limits of the results.

The project has not been evaluated in a classroom study. Software tests check
that calculations and browser features behave as intended; they cannot show
that the lessons improve learning or that a model captures musical perception.
The app is not a calibrated acoustic or timing instrument, diagnostic tool, or
complete transcription system. Its results do not measure student ability,
performer quality, or the success of an ensemble or teaching intervention.

## Claim taxonomy

Each claim in the app has one of seven labels. The label tells readers what
kind of evidence they are looking at and what it can support.

| Claim kind | What it means here | What it does not establish |
| --- | --- | --- |
| `definition-or-theorem` | An identity follows from the displayed definitions within the stated input domain. | How someone perceives, prefers, or performs music. |
| `computed-model-result` | An algorithm produced a value from the recorded inputs, seed, duration, and method. | An observation of musicians, a room, or a network. |
| `measured-observation` | A local algorithm extracted a feature from a short browser-audio segment. | Calibrated sound pressure level, a diagnosis, or a stable performer trait. |
| `transcription-hypothesis` | An estimator ranked possible tempo, meter, pitch, or chord labels. | Ground truth or a complete polyphonic score. |
| `empirical-literature` | A study informs the question within its population, task, material, and method. | That the app is validated or the finding applies universally. |
| `heuristic` | A stated proxy, multiplier, score, or interpretation band helps compare cases. | A validated scale of perception, musical quality, or deployment readiness. |
| `recommendation` | The interface suggests another inquiry, listening, or rehearsal activity. | That the activity is optimal or improves learning by itself. |

A label makes the basis of a claim visible. It does not strengthen the evidence.

## Ensemble model

### Reference equation

A common form of the Kuramoto model with network delays is:

```text
d theta_i / dt = omega_i
               + (K / d_i) sum_j A_ji sin(theta_j(t - tau_ji) - theta_i(t))
```

Here `theta_i` is oscillator phase, `omega_i` is natural angular frequency,
`A_ji` defines the interaction graph, `d_i` is an incoming-degree
normalization, `K` is coupling strength, and `tau_ji` is delay. This equation is
a reference for coupled oscillators. It leaves out much of what musicians
hear, intend, and do.

### Implemented equation

The lesson evaluator simulates eight seconds with a default integration step
of `0.01 s`. The lower-level simulation function also accepts an explicit
deterministic step size; the exported fixed-step driver uses `0.01 s`. For
oscillator `i`, the implemented equation is:

```text
d theta_i / dt = omega_i
  + [m_peer(texture) * rho_jitter / sqrt(d_i)]
      sum_(j -> i) K_ji sin(wrap(theta_j(t - tau_eff,ji(t)) - theta_i(t)))
  + C * m_click(texture)
      sin(wrap(Omega_click * t - theta_i(t)))
```

Several choices distinguish this implementation from the reference equation:

- it normalizes the incoming peer term by `sqrt(d_i)`, not by `d_i` or `N`;
- topology sets `K_ji`: all-to-all, leader–follower, or paired sections, with
  cross-section edges multiplied by `0.35`;
- repertoire texture changes natural-tempo spread, peer coupling, click
  coupling, the illustrative latency budget, and jitter reliability;
- effective delay adds deterministic, smoothly interpolated pseudo-jitter in
  `25 ms` control frames and clamps delay at zero;
- jitter also applies a separate heuristic reliability multiplier; and
- external click forcing is a separate sinusoidal term, not another peer.

The texture multipliers below are part of the calculation. They are teaching
heuristics and have not been fitted to performer or repertoire data.

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

Jitter therefore changes both the effective delay and the coupling reliability.
This lets students explore a stressed model. It does not reproduce a specific
audio codec, network, nervous system, or rehearsal.

### Reading the ensemble results

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
`unstable` from `0.85`. These bands are teaching
heuristics, not universal mouth-to-ear delay limits or criteria for accepting
a network deployment.

### Omitted phenomena

The phase-only model omits score hierarchy, expressive timing, onset shape,
instrument attack, room acoustics, visual and bodily cues, attention,
prediction, expertise, social roles, individual adaptation rules, hearing and
monitoring differences, packet loss, codec behavior, audio quality, and
audiovisual skew. Consider those omissions before applying a result to musicians
playing together.

## Other mathematical domains

The other seven domains use the same distinction between a calculation and
its musical interpretation:

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
  and spread. The app does not assign a target, score, grade, accuracy
  class, or better/worse label.

## Local audio

Microphone and file inputs are optional and processed in the browser. An
`AudioWorklet` sends microphone frames to a local Web Worker using a limited
number of credits to bound the queue. Selected file samples go directly to a
local worker. Raw PCM stays in memory and is excluded from the portfolio and
export. The app reports queue overflow, stale frames, and sequence gaps. See
the [audio guide](LOCAL_AUDIO_METHOD.md) for limits, settings, and data flow.

All audio-derived values are `uncalibrated`:

- dBFS describes digital amplitude relative to full scale; it is not sound
  pressure level;
- the noise-floor value is a low-percentile block-RMS estimate, not a calibrated
  room-noise measurement;
- clipping and silence indicators depend on explicit numerical thresholds;
- YIN estimates monophonic periodicity and reports a confidence value; it
  cannot identify every note in a recording;
- spectral flux proposes onsets; autocorrelation proposes tempo; repeated
  accent agreement proposes meter; and chroma-template similarity proposes up
  to three major, minor, or no-chord labels;
- no full polyphonic transcription, source separation, score alignment, SPL
  calibration, or latency calibration is implemented.

Recorded audio is marked non-deterministic. Recorded-Onset Hypotheses is the
only lesson that saves audio-derived A/B comparisons. Each comparison requires
a fresh analysis with one exposed analysis setting changed and the source and
frame settings held constant. Chord and time-varying-timbre audio views provide
additional observations; they do not form causal portfolio comparisons.

The W3C specifications describe browser interfaces and how their constraints
work. They do not validate the app's algorithms or musical interpretations.

## Pedagogical status and research rationale

The lesson sequence asks students to predict, experiment, compare, explain,
perform, and transfer an idea, with preparation and reflection around that
work. Source notes and interpretation limits help connect the activity to its
evidence. The following studies informed these design choices. None evaluated
Musica Mathematica.

- [Zhu, Jamaludin, and Li (2025)](https://doi.org/10.1371/journal.pone.0337590)
  studied a flipped music-theory module in a quasi-experiment with two intact
  undergraduate classes. The study gives one example of structured preparation,
  collaboration, and reflection. It does not show that this app will reproduce
  the reported outcomes.
- [Wang et al. (2025)](https://www.mdpi.com/2079-3200/13/12/162) reviewed 31
  music metacognition and self-regulated learning studies, with seven included
  in a meta-analysis. Their findings informed the use of planning, practice,
  reflection, strategy teaching, and teacher support. Differences among the
  studies limit conclusions about a universal effect.
- [Azaryahu, Ariel, and Leikin (2024)](https://www.nature.com/articles/s41599-024-03631-z)
  interviewed 16 Israeli experts in music, mathematics, and education. Their
  discussion of shared structure, aesthetics, creativity, and disciplinary
  expertise informed the links between subjects. This was a small qualitative
  interview study, not a test of educational effectiveness.
- [Jacoby et al. (2024)](https://www.nature.com/articles/s41562-023-01800-9)
  found preferences for integer-ratio rhythms across 39 groups in 15 countries,
  alongside variation related to local musical traditions. The rhythm lessons
  therefore ask students to consider alternatives to a single metrical grid.
- [Marjieh et al. (2024)](https://www.nature.com/articles/s41467-024-45812-z)
  found that timbral changes can reshape consonance preferences in large-scale
  behavioral studies. The timbre and consonance lesson takes up that question,
  but its partial-coincidence and roughness proxies are not calibrated replicas
  of the studies.
- [Snyder, Gordon, and Hannon (2024)](https://www.nature.com/articles/s44159-024-00315-y)
  review behavioral, neural, oscillator, and predictive accounts of rhythm,
  beat, and metre. These different accounts are a reason to compare
  representations instead of equating an onset vector with perception.
- [Frederick (2024, published online in 2023)](https://doi.org/10.1093/mts/mtad017)
  constructs a diatonic voice-leading space and relates it to the keyboard.
  This provides context for exploring transformations and geometry. It does
  not validate the app's simplified graph or voice-assignment metric.
- [Demos and Palmer (2023)](https://doi.org/10.1016/j.tics.2023.05.005) examine
  nonlinear and social dynamics in musical group synchrony. Their review
  argues that group behavior cannot be fully explained by independent
  pairwise models, a limit to keep in mind when using the ensemble simulator.
- [Abalde et al. (2024)](https://doi.org/10.1016/j.neubiorev.2024.105816) place
  coordination alongside knowledge, goals, strategies, and social factors in
  joint music making. The simulator omits many of these factors.
- The [W3C Web Audio API](https://www.w3.org/TR/webaudio/) defines the
  `AudioWorklet` interface used for capture. [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
  defines microphone permissions, tracks, constraints, and reported settings.

This is the research context for the lessons, not a systematic literature
review. Check the original studies and newer work when planning a course.

## Using results in teaching

Ask which variables were held constant, which representation produced the
result, and which source or method supports the conclusion. Then consider
what listening, score study, performance, or external measurement might add
or contradict.

The portfolio records that inquiry. It should not become an automatic grade
or evidence of accreditation, classroom effectiveness, performer ability,
ensemble quality, or network readiness. Those judgments require evidence
beyond the app.
