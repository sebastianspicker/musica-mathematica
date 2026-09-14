# Security policy

Musica Mathematica runs in the browser. It has no application backend,
accounts, or remote portfolio storage.

## Report a vulnerability

Use GitHub's private vulnerability reporting option when available. If it is
unavailable, open an issue asking for a private contact channel. Leave
vulnerability details out of that public issue.

In the private report, include the affected version, browser and operating
system, steps to reproduce the problem, expected and actual behavior, and the
potential impact. Reports about data handling, exports, microphone access,
audio processing, dependencies, or static deployment are welcome.

There is no response-time commitment for alpha releases.

## Learning records

The portfolio stores written responses, factor values, derived observations,
and their source information in `localStorage`. Learners can download it as
JSON. Those exports may contain personal data; clearing the app's storage does
not delete files that have already been downloaded.

The Pages demo uses `musicaMathematica.demo.learning.v2` for its example and
subsequent changes. Its storage adapter cannot access the ordinary
`musicaMathematica.learning.v2` record or the legacy migration record. Changes
to the demo must preserve that separation.

## Microphone and audio files

Microphone access starts with a user action and requires permission in a secure
browser context. The app requests that the browser disable audio processing,
but browsers and devices may not honor those settings.

Files are decoded in the browser. Local workers process selected samples and
microphone frames. The portfolio and its export exclude raw audio, file names,
media streams, and device identifiers. The
[audio guide](docs/LOCAL_AUDIO_METHOD.md) describes input limits and processing.

## Client code and deployment

Client source and build configuration are visible to anyone who receives the
bundle. Keep secrets, private service credentials, and privileged endpoints
out of both.

[index.html](index.html) defines the Content Security Policy. It allows
same-origin resources and the loopback WebSocket connections used during Vite
development. Check the deployed response headers as well; the HTML policy does
not configure every response. See [Deployment](docs/DEPLOYMENT.md).

## Dependencies

[package.json](package.json) declares the dependencies,
[pnpm-lock.yaml](pnpm-lock.yaml) locks their versions, and
[third-party notices](THIRD_PARTY_NOTICES.md) cover the browser bundle.
Run `pnpm audit --prod` to query the registry for production dependency
advisories. Dependency updates should include a review of lockfile and bundle
changes.
