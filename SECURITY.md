# Security policy

Musica Mathematica is a static browser application. It has no application
backend, account system, or remote persistence service.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when it is enabled. If it is not
available, open a public issue requesting a private contact channel without
including vulnerability details.

Include the affected version, browser and operating system, reproduction steps,
expected behavior, actual behavior, and potential impact.

## Trust boundaries

### Browser storage

The portfolio contains learner-entered text, factor values, derived
observations, and provenance. It is stored in `localStorage` and can be exported
as JSON. Treat exported portfolios as user data. Clearing application data does
not remove files already exported by the browser.

### Microphone and file input

Microphone access requires a user action, a secure context, and browser
permission. The application requests that browser audio processing be disabled,
but the browser or device may not honor those constraints.

Audio files are decoded in the browser. Selected samples and microphone frames
are processed by local workers. Raw audio, file names, media streams, and device
identifiers are excluded from portfolio storage and export.

### Client-side code

All application code and dependencies execute in the browser. Do not place
secrets, private service credentials, or privileged endpoints in client source
or build-time configuration.

`index.html` defines a same-origin Content Security Policy and allows loopback
WebSocket connections for Vite development. Deployments should also send
appropriate HTTP security headers. Review the deployed policy rather than
assuming the HTML meta policy covers every response.

### Dependencies

Runtime dependencies are recorded in `package.json`, locked in
`pnpm-lock.yaml`, and attributed in `THIRD_PARTY_NOTICES.md`. Use
`pnpm audit --prod` when registry access is available. Review lockfile and
bundle changes when updating dependencies.

## Scope

Reports about browser-side data handling, portfolio export, microphone
permissions, audio processing, dependency vulnerabilities, Content Security
Policy, or static deployment configuration are in scope.

The project does not publish a response-time commitment for alpha releases.
