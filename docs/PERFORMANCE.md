# Performance checks

Use these workloads to measure simulation, FFT, and playback changes. Run the
same harness and runtime on both revisions you want to compare, and check
correctness separately with the test suite.

The tables record earlier measurements. Simulation and FFT timings used Node
v26.8.1; playback used a Chromium development build as described below. Times
are in milliseconds. They do not measure microphone hardware or establish
production browser responsiveness.

## Ensemble simulation

The workload simulates eight seconds with 16 oscillators at 180 BPM, tempo
spread 24 BPM, peer and click strengths 3, delay 180 ms, jitter 60 ms,
all-to-all topology, and dense-rhythm texture. Each run uses five warmups and
21 measured repetitions. Median is sorted sample 11; p95 is sample 20.

| Implementation | Median (ms) | p95 (ms) |
| --- | ---: | ---: |
| Before edge grouping and binary delayed-history lookup | 40.62 | 46.67 |
| After, first repeat | 31.73 | 34.93 |
| After, second repeat | 37.35 | 45.82 |

The two repeats had lower median and p95 times, with noticeable variation
between runs. Edge order, integration steps, jitter, and delayed-state
selection stayed the same. The
[equivalence test](../src/domains/ensemble-dynamics/ensembleEquivalence.test.ts)
compares five complete simulations against the earlier edge-filtering and
linear-history algorithms from revision `0d8dfe3`. Both run on the same runtime
and must match exactly, including every trace point and metric. This avoids
assuming that floating-point results have identical bytes across platforms.
Shared initialization, mathematical helpers, metrics, and expanded input bounds
are covered by separate model tests.

Run the current workload with:

```sh
node benchmarks/ensemble.mjs
```

The script loads `src/domains/ensemble-dynamics/config.ts` and `model.ts`. The
table was measured inside Vitest. The standalone script uses the same
workload, but its times are not directly comparable with that table. Use one
harness consistently when measuring a change.

## FFT and selection transfer

The FFT workload processes deterministic two-tone frames at 48 kHz in batches
of 128. Each frame size gets three warmup batches and 15 measured batches.
Only the final 15 callbacks contribute to the results; Tinybench calibration
and warmup are excluded.

Both implementations were measured with the same harness, which loaded the
earlier `spectrum.ts` through a temporary Vite transform. The command below
measures the current implementation.

| Frame size | Before median / p95 (ms per frame) | Cached median / p95 |
| --- | ---: | ---: |
| 2,048 | 0.173519 / 0.180483 | 0.020991 / 0.021585 |
| 4,096 | 0.338153 / 0.341673 | 0.040038 / 0.040790 |

Run the current measurement with:

```sh
pnpm exec vitest bench src/audio/analysis/spectrum.performance.bench.ts --run --no-color
```

A separate transfer fixture covers 30 seconds and 1,405 frames. Its compact
JSON is 38,893 bytes. The earlier per-frame spectrum and chroma arrays alone
required 34,709,120 bytes before object overhead. These figures compare
transferred data, not browser heap use. Tests compare the compact and
full-detail analysis APIs on deterministic signals at both supported frame
sizes.

## Playback rendering

The playback fixture rendered the BPM lesson at 120 BPM with two saved demo
trials. It used Chromium 153.0.8010.12 at 1440 × 1000, with React development
StrictMode and Profiler enabled. Each of five repeats had two seconds of
warmup followed by five measured seconds. Vite file watching was disabled to
prevent refreshes during measurement. Counts include StrictMode's duplicate
renders.

| Measurement per five-second sample | Before | After |
| --- | ---: | ---: |
| React commits | 300 | 48–49 |
| ResultVisual renders and geometry work | 600 | 0 |
| Mean total React render time (ms) | 440.08 | 79.76 |
| Median total React render time (ms) | 343.50 | 74.90 |
| p95 total React render time (ms) | 629.60 | 93.30 |
| Per-commit median / p95 (ms) | 0.60 / 4.10 | 2.00 / 2.30 |

Total render time fell because there were fewer updates and no repeated chart
work. Median time per commit increased, so these results do not show faster
individual commits. Development timings vary and should be read separately
from production browser measurements.

Run the current measurement with:

```sh
pnpm exec playwright install chromium
node benchmarks/workbench.mjs current
```

The script uses local port 5193, opens the collapsed **Explore the model, charts
and playback** section first, and writes raw samples to
`/tmp/mm-workbench-current.json`. Its profiling code lives in the typed fixture
`benchmarks/workbenchProfileMain.tsx`, which runs only in the benchmark and is
not included in product builds.
