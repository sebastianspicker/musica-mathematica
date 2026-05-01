# Scientific Audit: Ensemble Coupling Lab

Date: 2026-04-29

## Executive Verdict

VERDICT: PARTIAL

The lab is scientifically plausible as a didactic coupled-oscillator simulator. The delayed Kuramoto framing, phase-circle display, coherence metric, and qualitative latency lessons are defensible.

The main limitation is calibration. Several numbers and labels currently read more empirical than they are:

- The "critical delay" / "latency budget" is an idealized model budget, not an experimentally validated performance threshold.
- The texture multipliers, jitter penalty, and peer-agency score are pedagogical heuristics.
- The "20-30 ms one-way comfort region" statement is directionally reasonable for tight synchronous NMP, but too narrow if presented as a general scientific boundary.
- The Cologne-Prague / HfMT LoLa-MVTP scenario needs either public measurement metadata or weaker wording as an illustrative local case.

No critical scientific contradiction was found in the core idea. The app should remain usable, but the UI and documentation should explicitly separate theory-backed claims from heuristic teaching parameters.

## Evidence Standard

This audit treats peer-reviewed articles, DOI records, PubMed/PMC records, and publisher pages as evidence. Blog posts are background only. The simulation must stand on its own without relying on external blog context.

Claim status labels:

- Supported: directly backed by scientific literature or a standard mathematical definition.
- Partially supported: consistent with evidence, but current wording or scope is too broad.
- Pedagogical heuristic: useful for teaching, but not calibrated or validated as a scientific metric.
- Overstated: likely true in some contexts, but phrased too generally.
- Unsupported: no adequate evidence found for the claim as currently stated.

## Claim Matrix

| App surface | Current claim or behavior | Status | Evidence comparison | Required correction |
| --- | --- | --- | --- | --- |
| `FormalModel.tsx` | Ensemble timing can be modeled as delayed Kuramoto coupling: `d theta_i / dt = omega_i + sum_j K_ij sin(theta_j(t - tau_ij) - theta_i)`. | Supported | Strogatz reviews the Kuramoto model as coupled limit-cycle oscillators with natural frequency distributions and synchronization onset. Yeung and Strogatz extend it to time-delayed interactions. | Keep. Add one sentence that this is a phase-only abstraction, not a complete musician model. |
| `coherence()` | `r` is the magnitude of the mean phase vector. | Supported | This is the standard Kuramoto order parameter form. | Keep. |
| `criticalDelaySeconds()` | `pi / (2 * omega)` is displayed as "critical delay" / "latency budget". | Partially supported | Delayed Kuramoto theory supports delay-dependent stability boundaries. The specific quarter-cycle budget is a simplified phase-margin rule and ignores coupling strength, frequency distribution, topology, adaptation, and task. | Rename or explain as "idealized model budget"; do not imply empirical threshold. |
| `MetricsPanel.tsx` | Faster tempi tolerate less delay because the same delay occupies more of the beat. | Supported | Directly follows from delay as phase lag: phase lag scales with angular frequency. Empirical NMP studies also show tempo/task dependence. | Keep. |
| `MetricsPanel.tsx` | Tight rhythmic playing is near a 20-30 ms one-way comfort region. | Partially supported / Overstated | Literature often targets very low latency for synchronous NMP, but controlled studies show task-dependent ranges: Chafe et al. tested 3-78 ms and found distinct regimes; Bartlette et al. found strong degradation at and above 100 ms; Tsioutas/Xylomenos report some musicians maintaining steady tempo at 40 ms one-way in real NMP settings. | Reword as "often targeted around 20-30 ms for tight synchronous material, but empirical tolerance varies by task, tempo, instrumentation, and adaptation." |
| `textureProfile()` | Drone, rubato, call-response, pulse, dense rhythm change latency budget, coupling salience, click usefulness, and jitter penalty by fixed multipliers. | Pedagogical heuristic | Literature supports that musical task, rhythmic density, timbre, tempo, and interaction role affect delay tolerance. The exact multipliers in the app are not evidence-calibrated. | Label multipliers as qualitative teaching parameters; avoid implying measured thresholds. |
| `feedbackReliability()` | Jitter reduces feedback reliability and can be worse than stable delay. | Partially supported | NMP engineering reviews identify capture, buffering, packet delay, and network variation as important. Variable delay can force buffering and destabilize feedback. The exact penalty formula is arbitrary. | Keep qualitative claim; label the formula as a heuristic instability penalty. |
| `peerAgency()` | Peer agency equals `K / (K + clickStrength)`. | Pedagogical heuristic | External forcing by a click can improve timing precision but changes the coordination task. The app's percentage is not a validated agency metric. | Rename as "peer-coupling share" or add "didactic proxy". |
| Topologies | Everyone-hears-everyone, leader-follower, sections, and click track model interaction structures. | Partially supported | Group synchrony literature stresses roles, group size, and emergent structures; NMP routing can shape interaction. The app simplifies acoustic, visual, attentional, and spatial cues. | Keep as simplified interaction graphs. |
| Lesson 4 | Cologne-Prague near 7.5 ms one-way is used as a feasibility scenario. | Unsupported as public scientific evidence | The value may be a local measurement, but the app does not include measurement method, date, path, equipment, or variance. | Present as "example low-latency route" unless measurement metadata is documented. |
| `TheorySection.tsx` | "HfMT LoLa/MVTP latency measurements" are included as evidence context. | Partially supported / needs provenance | LoLa-style systems are documented in the NMP literature, but the local HfMT measurement claim needs reproducible context. | Add provenance or make the local reference explicitly illustrative. |
| `rehearsalSuggestions()` | Slow tempo, simplify density, add leader/sections/click, or compose with delay. | Partially supported | These are practical extrapolations consistent with synchronization and NMP evidence, but they are not automatic prescriptions validated by the simulator. | Keep as suggestions, not diagnoses. |

## Findings

### High: "Critical Delay" Can Be Misread as an Empirical Limit

The code computes:

```text
criticalDelaySeconds = pi / (2 * omega)
```

Because `omega = 2 pi * BPM / 60`, this is:

```text
criticalDelaySeconds = 15 / BPM
```

Examples:

| Tempo | Model budget before texture multiplier |
| --- | ---: |
| 60 BPM | 250 ms |
| 90 BPM | 167 ms |
| 120 BPM | 125 ms |
| 180 BPM | 83 ms |

This is useful as a phase-margin teaching device: a fixed physical delay consumes more phase at higher tempo. However, delayed Kuramoto stability is not controlled by tempo alone. Coupling strength, natural-frequency spread, topology, distribution shape, and delay structure all matter.

Scientific comparison:

- Yeung and Strogatz show that delayed Kuramoto systems have delay-dependent stability boundaries and additional dynamical regimes, including bistability and time-dependent order parameters.
- Empirical NMP studies do not give a single critical delay. Chafe et al. manipulated 3-78 ms one-way delays and found distinct interaction regimes. Bartlette et al. tested 0-200 ms and reported strong degradation at and above 100 ms for their Mozart duet tasks. Tsioutas/Xylomenos evidence suggests some musicians can maintain steady tempo at 40 ms one-way in specific real NMP settings.

Correction:

- Keep the calculation.
- Treat it as an "idealized phase budget" or "model latency budget".
- Avoid using "critical" unless the UI explicitly says it is not an empirical safety threshold.

### High: The 20-30 ms Statement Needs Narrower Scope

The current sentence says:

```text
Empirical networked-performance work places tight rhythmic playing near a
20-30 ms one-way comfort region...
```

This is broadly plausible for strict synchronous performance targets, but too compressed.

Evidence comparison:

- Chafe et al. report that delays both below and above a natural ensemble-distance envelope create characteristic dynamics, and longer delays lead to lagging, deceleration, and deterioration.
- Bartlette et al. found that performances were strongly affected at and above 100 ms, but their tested set includes several lower delay values and the outcome depended on musical strategy.
- Tsioutas/Xylomenos and later NMP work emphasize high variance across participants, instruments, tempo, and musical material.
- Rottondi et al. explicitly frame latency tolerance as a psycho-perceptual and technological problem, not a single universal threshold.

Correction:

Use wording like:

```text
For tight synchronous rhythmic material, NMP systems often target roughly
20-30 ms one-way latency. Empirical tolerance is task-dependent: tempo,
instrument attack, texture, monitoring, musician strategy, and jitter can
move the practical boundary substantially.
```

### Medium: Texture Multipliers Are Didactic, Not Calibrated

The app gives each texture fixed multipliers for tempo spread, peer coupling, click strength, latency budget, and jitter penalty.

This is pedagogically coherent:

- Dense rhythmic material depends strongly on simultaneous attacks.
- Drone and rubato material can tolerate looser simultaneity.
- Call-response material can transform delay into musical structure.

But the exact multipliers are not supported as measured constants.

Correction:

- Keep the multipliers for exploration.
- Add an explicit statement in the theory or controls: "Texture profiles are qualitative teaching presets, not measured latency-tolerance curves."
- In tests, continue checking relative ordering rather than numerical truth.

### Medium: Jitter Claim Is Directionally Correct But Formula Is Arbitrary

The current model treats jitter in two ways:

- `effectiveDelaySeconds()` adds deterministic frame-to-frame delay variation.
- `feedbackReliability()` reduces coupling effectiveness based on jitter/latency ratio.

Scientific comparison:

- NMP technology literature supports cumulative delay accounting across capture, buffering, network, and playback.
- Variable delay is harmful because real systems either expose timing variation or add buffering to smooth it.
- The app's specific penalty `1 - jitterRatio * 1.35 * profile.jitterPenaltyMultiplier` is not a measured relationship.

Correction:

- Keep "jitter is an instability risk".
- Label the penalty as a heuristic that turns variable delay into degraded feedback.

### Medium: Peer Agency Is a Useful Proxy, Not a Scientific Metric

`peerAgency = K / (K + clickTrackStrength)` is easy to understand and works well pedagogically.

Scientific comparison:

- Click tracks and metronomes can increase timing regularity by providing external temporal structure.
- Musical agency, attention, expressive microtiming, leadership, and adaptation are not reducible to this scalar.

Correction:

- Rename to "peer-coupling share" if the UI should be scientifically conservative.
- If "agency" remains, add "didactic proxy" in the explanatory text.

### Medium: Topology Is Scientifically Plausible But Simplified

The app topologies map well to teaching:

- all-to-all: peer listening
- leader-follower: asymmetric timing authority
- sections: local subgroup coupling
- click-track: external forcing

Scientific comparison:

- Group synchrony literature supports the importance of roles, group size, and emergent structures.
- Real ensembles also use visual cueing, spatial acoustics, score hierarchy, individual adaptation strategies, room reflections, and instrument-specific attack times.

Correction:

- Keep topologies as graph abstractions.
- Avoid implying that they capture the full ensemble situation.

### Low: Cologne-Prague Scenario Needs Provenance

The 7.5 ms one-way latency scenario is valuable for HfMT teaching, but it is not scientifically auditable from the app alone.

Correction options:

- Add measurement metadata: date, route, endpoints, tool, sample size, one-way vs round-trip method, median, p95, jitter.
- Or reword as a hypothetical: "Example low-latency route near 7.5 ms one-way."

### Low: Infrastructure Claim Is Good But Should Stay Operational

The theory section says that routing, campus hops, firewall inspection, buffer policy, documentation, support, and governance determine whether a rehearsal is playable.

This is a strong operational point and fits NMP practice. The scientific claim should stay modest:

- Supported: end-to-end delay is cumulative and depends on system architecture.
- Supported: buffering and network behavior matter.
- Operational, not strictly scientific: documentation/support/governance determine whether a session works "on a real Tuesday afternoon."

Correction:

- Keep it, but frame it as operational reliability rather than physics.

## Positive Findings

The app gets several important ideas right:

- Experience-first structure is appropriate for a didactic physics/music tool.
- The phase circle is a clear visualization of the Kuramoto order parameter.
- The formal equation appears after exploration, which matches the intended pedagogical scaffold.
- Tempo, delay, jitter, topology, click strength, and texture are the right control families.
- The lesson structure maps well to practical NMP decisions: slow down, simplify texture, add structure, change routing, or compose with delay.

## Recommended Follow-Up Fixes

These are documentation/UI fixes, not simulator rewrites:

1. Rename "Latency budget" explanatory text to "Model latency budget" or "Idealized phase budget".
2. Add one sentence near the formula: "This is a phase-only model; the texture, jitter, and agency parameters are qualitative teaching controls."
3. Reword the empirical latency paragraph to avoid a universal 20-30 ms boundary.
4. Add provenance or hypothetical wording for the Cologne-Prague 7.5 ms lesson.
5. Rename "Peer agency" to "Peer-coupling share" or label it explicitly as a proxy.
6. Add a small bibliography/source note inside the app or a linked `SCIENTIFIC_NOTES.md` if the tool is used in class.

## Evidence Notes

### Kuramoto and Delayed Coupling

- Strogatz, S. H. (2000). "From Kuramoto to Crawford: exploring the onset of synchronization in populations of coupled oscillators." Physica D: Nonlinear Phenomena, 143(1-4), 1-20. https://doi.org/10.1016/S0167-2789(00)00094-4
- Yeung, M. K. S., & Strogatz, S. H. (1999). "Time Delay in the Kuramoto Model of Coupled Oscillators." Physical Review Letters, 82, 648-651. https://doi.org/10.1103/PhysRevLett.82.648
- Neda, Z., Ravasz, E., Vicsek, T., Brechet, Y., & Barabasi, A. L. (2000). "Physics of the rhythmic applause." Physical Review E, 61, 6987-6992. https://doi.org/10.1103/PhysRevE.61.6987

### Networked Music Performance and Latency

- Chafe, C., Caceres, J.-P., & Gurevich, M. (2010). "Effect of temporal separation on synchronization in rhythmic performance." Perception, 39(7), 982-992. https://doi.org/10.1068/p6465
- Bartlette, C., Headlam, D., Bocko, M. F., & Velikic, G. (2006). "Effect of network latency on interactive musical performance." Music Perception, 24(1), 49-62. https://doi.org/10.1525/mp.2006.24.1.49
- Driessen, P. F., Darcie, T. E., & Pillay, B. (2011). "The Effects of Network Delay on Tempo in Musical Performance." Computer Music Journal, 35(1), 76-89. https://doi.org/10.1162/COMJ_a_00041
- Rottondi, C., Chafe, C., Allocchio, C., & Sarti, A. (2016). "An Overview on Networked Music Performance Technologies." IEEE Access, 4, 8823-8843. https://doi.org/10.1109/ACCESS.2016.2628440
- Drioli, C., Allocchio, C., & Buso, N. (2013). "Networked Performances and Natural Interaction via LOLA: Low Latency High Quality A/V Streaming System." Lecture Notes in Computer Science. https://doi.org/10.1007/978-3-642-40050-6_21
- Tsioutas, K., Xylomenos, G., & Doumanis, I. (2021). "An Empirical Evaluation of QoME for NMP." NTMS 2021. https://doi.org/10.1109/NTMS49979.2021.9432657
- Tsioutas, K., & Xylomenos, G. (2021). "On the Impact of Audio Characteristics to the Quality of Musicians' Experience in Network Music Performance." Journal of the Audio Engineering Society, 69(12), 914-923. https://doi.org/10.17743/jaes.2021.0041
- Tsioutas, K., & Xylomenos, G. (2022). "Assessing the Effects of Delay to NMP via Audio Analysis." SN Computer Science, 4, 126. https://doi.org/10.1007/s42979-022-01555-6

### Musical Synchrony, Group Roles, and Phase Measures

- Demos, A. P., & Palmer, C. (2023). "Social and nonlinear dynamics unite: musical group synchrony." Trends in Cognitive Sciences, 27(11), 1008-1018. https://doi.org/10.1016/j.tics.2023.05.005
- Lindenberger, U., Li, S.-C., Gruber, W., & Muller, V. (2009). "Brains swinging in concert: cortical phase synchronization while playing guitar." BMC Neuroscience, 10, 22. https://doi.org/10.1186/1471-2202-10-22

## Bottom Line

The current simulator is a strong teaching harness, not a validated scientific instrument. That is acceptable if the app says so clearly. The next scientific-hardening pass should focus on wording and provenance, not on adding more features.
