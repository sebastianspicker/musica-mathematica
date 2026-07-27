# Local Audio Method

Status: browser-local, bounded, uncalibrated teaching analysis

Applies to: Recorded-Onset Hypotheses, Chord Hypotheses, and Time-Varying Timbre

## Method boundary

The local audio path lets a learner inspect descriptive signal features and
ranked musical hypotheses without adding a backend or putting raw sound into the
learning portfolio. It is designed for short classroom examples, not archival
recording, calibrated measurement, automatic score production, performer
assessment, or low-latency monitoring.

Synthetic mode is the default and requires no microphone or file. The learner
must explicitly choose microphone or file mode in one of the three lessons that
supports it.

## Data flow

```text
synthetic fixture
  -> deterministic lesson evaluator
  -> displayed result / optional normalized trial snapshot

microphone, after user action and browser permission
  -> MediaStream track
  -> AudioWorklet 2,048- or 4,096-sample ring frame
  -> credit-bounded MessagePort
  -> local Web Worker
  -> Hann window + FFT + derived features/hypotheses
  -> displayed result / optional normalized trial snapshot
  -> stop tracks, disconnect graph, terminate worker

browser-decodable audio file
  -> local ArrayBuffer and AudioBuffer decode
  -> selected channels averaged to one bounded mono Float32Array
  -> ownership transferred to a local Web Worker
  -> Hann frames + FFT + derived features/hypotheses
  -> terminate worker and discard transient samples
  -> displayed result / optional normalized trial snapshot
```

No application network request exists in this path. Browser or operating-system
media services remain part of the learner's local platform and are outside this
repository's control.

## Input contracts

### Microphone

- Capture must be initiated by a click or keyboard action and requires a secure
  browser context.
- Duration must be from 5 through 20 seconds. The UI defaults to 8 seconds.
- The request asks the browser for audio with `autoGainControl`,
  `echoCancellation`, and `noiseSuppression` set to `false`, and requests no
  video. These are constraints, not guarantees.
- The app reads back and displays only a safe subset of the settings the browser
  actually applied: sample rate, sample size, channel count, the three
  processing flags, and reported latency when numeric.
- Device ID, group ID, label, device name, and other media-track fields are not
  copied into provenance or the learning portfolio.
- All tracks are stopped on the requested timeout, mode change, component
  teardown, analysis-pipeline stop, or failure after stream acquisition.

The browser remains responsible for permission presentation and source choice.
The app cannot guarantee that a browser or device honors the three requested
processing constraints, which is why actual safe settings are shown.

### File

- The selected file must have an `audio/*` media type and a positive size no
  greater than 25 MiB.
- The browser must be able to decode it through `decodeAudioData`; accepting the
  media type does not guarantee codec support.
- Decoded duration must be positive and no greater than 90 seconds.
- The learner chooses a positive range inside the decoded sound, no longer than
  30 seconds.
- Channels are averaged into one mono selection. This discards channel-specific
  spatial and phase information and can cancel out-of-phase content.
- The file name and original encoded bytes are not written to analysis
  provenance or the portfolio. After worker transfer, the selected
  `Float32Array` is detached from the UI context.

## Scheduling and bounded work

The microphone worklet collects the first input channel into a ring buffer and
emits a frame every half frame, giving 50% overlap. It starts with four worker
credits by default. If no credit is available, it increments a dropped-frame
count instead of allocating another pending frame.

The worker also owns a queue with capacity four. It rejects stale or repeated
sequence numbers, removes oldest frames on overflow, and counts inferred
sequence gaps. The next accepted frame reports drops that occurred before it.
This prevents an unbounded backlog and keeps feature extraction off the UI
thread; it does not guarantee gap-free capture on an overloaded device.

When a gap breaks adjacency, the streaming spectral-flux value is reset rather
than pretending two non-adjacent frames are consecutive. The UI publishes the
drop and gap count in provenance.

## Analysis settings

| Item | Implemented method |
| --- | --- |
| Frame size | 2,048 or 4,096 samples |
| Hop size | Half the frame size (50% overlap) |
| Window | Symmetric Hann window |
| Spectrum | Real FFT; single-sided magnitude and power arrays through the isolated `fft.js` adapter |
| Waveform | At most 256 min/max/RMS envelope blocks; raw PCM is not retained in the envelope |
| Level | RMS and `20 log10(RMS)` dBFS |
| Silence indicator | Frame RMS below `-60 dBFS` |
| Clipping indicator | Ratio of samples with absolute value at least `0.999` |
| Noise floor | Tenth percentile of 256-sample block RMS levels, in dBFS |
| Spectral centroid | Magnitude-weighted mean frequency |
| Spectral flatness | Geometric-to-arithmetic mean ratio of power |
| Spectral roll-off | Frequency containing 85% of spectral power |
| Harmonicity | Fraction of eligible power within 35 cents of integer multiples of the estimated fundamental |
| Chroma | Twelve power bins from frequencies at or above 40 Hz, mapped through rounded equal-tempered MIDI pitch class at A4 = 440 Hz |
| Pitch | Monophonic YIN-style periodicity estimate, normally 50–1,200 Hz, with confidence; returns no frequency when evidence is insufficient |
| Onset strength | Positive, magnitude-normalized spectral flux |
| Onset candidates | Local flux peaks above a median plus a sensitivity-scaled median absolute deviation |
| Tempo hypotheses | Up to three positive autocorrelation peaks, normally 40–240 BPM, normalized into relative confidence values |
| Meter hypotheses | Up to three candidates from repeated beat-strength agreement and downbeat contrast among 2, 3, 4, and 6 beats |
| Chord hypotheses | Up to three cosine-similarity candidates over major, minor, and no-chord chroma templates |

Confidence is a score internal to an estimator's candidate set. It is not a
calibrated posterior probability or an accuracy guarantee. The chord path does
not recover inversion, voicing, harmonic function, non-triadic sonorities, or a
complete score. The pitch path is monophonic; the tempo and meter paths can
produce octave, subdivision, and grouping ambiguities.

## Persisted and exported data

Only a normalized `TrialSnapshotV2` may enter the browser portfolio. A recorded
audio-derived snapshot is permitted only in Recorded-Onset Hypotheses, where a
fresh analysis changes onset threshold or candidate family while source, sample
rate, frame size, and hop size remain fixed. Chord Hypotheses and Time-Varying
Timbre expose microphone/file results as observation appendices; their
controlled A/B trials use the synthetic model. A permitted audio-derived
snapshot can contain:

- lesson and protocol identifiers;
- selected factor values;
- derived observables and bounded display traces;
- source kind (`microphone` or `file`), sample rate, frame size, hop size,
  calibration status, method text, and a dropped-frame count; and
- an optional learner note.

It cannot contain raw PCM, an encoded audio file, a `MediaStream`, an
`AudioBuffer`, device identifiers, device labels, file names, or object URLs.
Portfolio sanitization caps each lesson at 12 trials and each trial at 256 trace
points. Export writes the same sanitized derived record, not the source audio.
Microphone and file snapshots are explicitly non-deterministic and never carry
a synthetic seed. Changing a factor, frame size, or selection range invalidates
the prior audio analysis and requires a fresh bounded segment.

Raw audio is also not offered as a download. If a learner separately records,
uploads, prints, or exports material outside this app, those copies are outside
the app's clearing control.

## Calibration and interpretation

Every local audio result has calibration status `uncalibrated`.

- dBFS is relative to digital full scale and cannot be converted to SPL without
  a calibrated acquisition chain and procedure.
- Browser-reported latency is a media setting, not a measured acoustic,
  round-trip, network, or performer-response latency.
- The low-percentile noise-floor estimate is descriptive for the selected
  samples; it is not a sound-level survey.
- Feature values depend on microphone placement, device processing, codec,
  channel mixing, sample rate, frame size, window, threshold, repertoire,
  articulation, and background sound.
- Tempo, meter, pitch, onset, and chord outputs are explicitly
  `transcription-hypothesis` claims. Check them by ear, against a score, through
  tapping or playing, and against alternative settings.
- Event-alignment median and IQR describe signed differences. They never become
  a quality score, accuracy class, grade, or better/worse judgment.

## Browser standards

The implementation follows the interface contracts described by the
[W3C Web Audio API](https://www.w3.org/TR/webaudio/) and
[W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/).
The former defines `AudioWorklet` processing and message-based coordination; the
latter defines permissioned `getUserMedia`, audio constraints, tracks, and
reported settings. These standards define platform behavior, not the scientific
validity of the feature algorithms above.

## FFT dependency status

The production worker imports the isolated `fft.js` adapter. `package.json` and
`pnpm-lock.yaml` resolve the runtime package to `fft.js@4.0.4` under the MIT
license. The production build includes the adapter.

## Verification boundary

Synthetic fixtures and focused tests can verify framing, windowing, adapter
shape, feature arithmetic, hypotheses, queue accounting, input limits,
sanitization, track stopping, worker transfer, and portfolio privacy. Browser
smoke tests can verify the visible permission-independent surface and synthetic
mode. Hardware microphone behavior, codec availability, permission UI, actual
constraint application, overload behavior, and acoustic validity vary by
browser and device and require separate runtime observation.
