# Local audio guide

Audio input lets students examine short recordings in Recorded-Onset
Hypotheses, Chord Hypotheses, and Time-Varying Timbre. This guide explains what
the browser processes, which results it produces, and what those results mean.

## Scope

The audio path describes short recordings through signal features and ranked
musical hypotheses. It does not archive recordings, produce calibrated
measurements or scores, assess performers, or provide low-latency monitoring.
Synthetic input remains the default. A learner must explicitly choose
microphone or file input in one of the three lessons that supports audio.

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

Application code makes no network request during this flow. Browser and
operating-system media services are still part of the learner's local platform
and remain outside the repository's control.

## Input limits and lifecycle

### Microphone

Capture starts only after a click or keyboard action, in a secure browser
context. A segment lasts from 5 through 20 seconds, with an 8-second default.
The media request sets `autoGainControl`, `echoCancellation`, and
`noiseSuppression` to `false` and requests no video. Browsers treat these as
requested constraints and may not honor them.

The UI reports a limited set of applied settings: sample rate, sample size,
channel count, the three processing flags, and latency when the browser provides
it as a number. Device ID, group ID, label, device name, and all other track
fields are excluded from analysis provenance and the learning portfolio.

Worker and AudioWorklet resources are prepared before the app requests the
stream. A single capture deadline begins when the stream is acquired. At the
deadline, the app immediately stops the tracks, tells the worklet to stop
accepting input, and sends an end marker over the same port that carried the
frames. The worker then produces its final result. If finalization takes longer
than one second, the app aborts the remaining resources.

Changing input mode, unmounting the component, stopping the analysis pipeline,
encountering an error, or abandoning a request cancels capture immediately. If
permission resolves after cancellation, the returned tracks are stopped without
being attached. These paths, together with the normal deadline, all stop every
acquired track.

The browser remains responsible for the permission prompt and source choice.
Displaying the applied safe settings lets the learner see whether the browser
reported the requested processing configuration.

### Audio file

The selected file must:

- have an `audio/*` media type;
- have a positive size no greater than 25 MiB;
- expose a finite duration no greater than 90 seconds through the browser's
  metadata reader before full decoding begins;
- decode through the browser's `decodeAudioData` implementation;
- decode to a positive duration no greater than 90 seconds; and
- provide a positive selected range within the decoded audio, no longer than
  30 seconds.

An accepted media type does not guarantee codec support. The decoder averages
the selected channels into one mono signal, which discards spatial and
channel-specific phase information and may cancel out-of-phase content. Neither
the file name nor the original encoded bytes enter provenance or the portfolio.
When the app transfers the selected `Float32Array` to the worker, the array is
detached from the UI context.

The metadata check uses a short-lived local object URL, fails closed when the
browser cannot establish a finite duration, and releases the URL before the
encoded bytes are read. The decoded-duration check remains in place so metadata
and decoder results are both constrained. Cancelling the request prevents a
pending metadata or file-read stage from starting the decoder; browser Web Audio
does not expose a way to interrupt a native decode that has already begun.

## Scheduling and bounded work

For microphone input, the AudioWorklet reads the first input channel into a ring
buffer. It emits a frame every half frame, so adjacent frames overlap by 50%.
The worklet begins with four worker credits. Without an available credit, it
counts a dropped frame instead of allocating another pending frame.

The worker has a separate queue with capacity four. It rejects repeated or stale
sequence numbers, discards the oldest frame when the queue overflows, and counts
gaps inferred from the sequence. Each accepted frame carries the number of
worklet drops since the previous accepted frame. This accounting bounds the
backlog and keeps feature extraction off the UI thread, but an overloaded device
can still produce gaps.

Spectral flux compares adjacent frames. If a sequence gap breaks that adjacency,
the streaming calculation resets rather than comparing frames that were not
neighbors in time. The UI folds worklet drops, stale and overflow frames, and
inferred sequence gaps into the provenance dropped-frame count.

Every accepted streaming frame is analyzed and returns one credit. The worker
refreshes temporal hypotheses and UI results after the first frame, after each
250 ms of audio time, and when capture finishes. For a file selection, it returns
a compact summary containing feature means, a waveform envelope, the noise-floor
estimate, and hypotheses.

At most 256 spectral-flux points represent the complete selection, including
both endpoints. Each timestamp comes from the original frame index, hop size,
and sample rate. Callers that need every frame can use the portable
`analyzeAudioSelection` API. The worker keeps a two-entry cache for FFT, Hann
window, and scratch storage, and returns spectrum arrays with independent
ownership.

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
| Pitch | Monophonic YIN-style periodicity estimate, normally 50 to 1,200 Hz, with confidence; returns no frequency when evidence is insufficient |
| Onset strength | Positive, magnitude-normalized spectral flux |
| Onset candidates | Local flux peaks above a median plus a sensitivity-scaled median absolute deviation |
| Tempo hypotheses | Up to three positive autocorrelation peaks, normally 40 to 240 BPM, normalized into relative confidence values |
| Meter hypotheses | Up to three candidates from repeated beat-strength agreement and downbeat contrast among 2, 3, 4, and 6 beats |
| Chord hypotheses | Up to three cosine-similarity candidates over major, minor, and no-chord chroma templates |

Confidence ranks candidates within one estimator result. It is not a calibrated
posterior probability or an assurance of accuracy. Chord analysis does not
recover inversion, voicing, harmonic function, non-triadic sonorities, or a
complete score. Pitch analysis is monophonic. Tempo and meter estimates can
confuse octaves, subdivisions, and metrical groupings.

## What the portfolio stores

The portfolio accepts only a normalized `TrialSnapshotV2`. Recorded-Onset
Hypotheses is the only lesson that may record an audio-derived snapshot for a
controlled comparison. In that lesson, a fresh analysis may change the onset
threshold or candidate family while source, sample rate, frame size, and hop
size stay fixed. Chord Hypotheses and Time-Varying Timbre show microphone and
file results as additional observations; their controlled A/B trials use the
synthetic model.

An allowed audio-derived snapshot can contain:

- lesson and protocol identifiers;
- selected factor values;
- derived observables and bounded display traces;
- source kind (`microphone` or `file`), sample rate, frame size, hop size,
  calibration status, method text, and a dropped-frame count; and
- an optional learner note.

It cannot contain raw PCM, encoded audio, a `MediaStream`, an `AudioBuffer`,
device identifiers, device labels, file names, or object URLs. Sanitization
limits each lesson to 12 trials and each trial to 256 trace points. Export writes
the same sanitized derived records, never the source audio. Microphone and file
snapshots are non-deterministic and do not carry a synthetic seed. Changing a
factor, frame size, or file selection invalidates the previous audio analysis
and requires a new bounded segment.

The app does not offer raw audio as a download. Copies created separately by a
learner through another recording, upload, print, or export path are outside the
app's control.

## Calibration and interpretation

Every local audio result has calibration status `uncalibrated`.

- dBFS is measured relative to digital full scale. Converting it to SPL requires
  a calibrated acquisition chain and procedure.
- Browser-reported latency is a media setting. It is not measured acoustic,
  round-trip, network, or performer-response latency.
- The low-percentile noise-floor estimate describes the selected samples. It is
  not a sound-level survey.
- Feature values depend on microphone placement, device processing, codec,
  channel mixing, sample rate, frame size, window, threshold, repertoire,
  articulation, and background sound.
- Tempo, meter, pitch, onset, and chord outputs carry
  `transcription-hypothesis` claims. Learners should check them by ear, against
  a score, through tapping or playing, and with alternative settings.
- Event-alignment median and IQR describe signed differences. They do not become
  a quality score, accuracy class, grade, or better-or-worse judgment.

## Browser standards and FFT dependency

The browser integration follows the interface contracts in the
[W3C Web Audio API](https://www.w3.org/TR/webaudio/) and
[W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/).
Web Audio defines AudioWorklet processing and message-based coordination. Media
Capture defines permissioned `getUserMedia`, audio constraints, tracks, and
reported settings. Neither standard establishes the scientific validity of the
feature algorithms.

The production worker uses the isolated `fft.js` adapter. `package.json` and
`pnpm-lock.yaml` resolve `fft.js@4.0.4`, under the MIT license, and the production
build includes the adapter.

## What verification covers

Synthetic fixtures and focused tests cover framing, windowing, the FFT adapter
shape, feature arithmetic, hypothesis ranking, queue accounting, input limits,
sanitization, track stopping, worker transfer, and portfolio privacy. The browser
suite exercises root and Pages builds in Chromium, Firefox, and WebKit,
including synthetic lessons and analysis of generated audio files.

Microphone hardware, codec availability, permission UI, applied constraints,
overload behavior, and acoustic validity vary across browsers and devices. They
require observation in the target runtime.
