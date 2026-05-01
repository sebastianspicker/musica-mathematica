# Ensemble Coupling Lab

Interactive TypeScript harness for teaching ensemble synchronisation as applied physics.

The lab models each musician as an oscillator:

```txt
musician = phase + natural tempo + coupling to others + delayed feedback
```

It is designed for a university of music context: students first hear and see an
ensemble drift, lock in, or collapse, then connect the experience to a delayed
Kuramoto-style model.

## Scientific status

This is a teaching simulator, not a calibrated measurement instrument. The
delayed Kuramoto model and order parameter are the physics backbone; the texture
profiles, jitter penalty, and click-track tradeoff are qualitative teaching
controls. See `SCIENTIFIC_AUDIT.md` for the evidence comparison.

## MVP scope

- Vite + React + TypeScript
- Pure simulation core in `src/simulation/`
- SVG phase circle and coherence/error plots
- Web Audio pulses for oscillator crossings
- Live exploration controls for tempo, spread, listening strength, latency,
  jitter, topology, texture, click strength, and ensemble size
- Seven guided lessons:
  - lock-in through listening
  - latency as a compositional parameter
  - click track versus peer adaptation
  - low-latency route feasibility
  - instability diagnosis
  - click strength versus peer coupling
  - composing with delay
- Vitest invariants for the core didactic claims

Out of scope for this harness:

- audio input
- score parsing
- machine learning
- real-time network measurement

## Run

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`.

## Verify

```sh
pnpm verify
```

## Teaching Use

The first useful classroom sequence is:

1. Press play with low coupling and moderate tempo spread.
2. Increase listening strength \(K_{ij}\) until the ensemble locks.
3. Add latency and jitter until the lock becomes fragile.
4. Switch to click-track mode and discuss what stabilises, and what musical
   peer coupling is displaced.
5. Change texture and ensemble size without restarting. The lab keeps current
   phases while retuning the model for exploration.

The formal model appears only after the experience:

\[
\frac{d\theta_i}{dt}
=
\omega_i
+
\sum_j K_{ij}\sin(\theta_j(t-\tau_{ij})-\theta_i)
\]

This turns latency from a hidden technical defect into a visible musical
dynamical system.
