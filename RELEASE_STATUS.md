# Candidate release status

Updated: 2026-08-18. The application is not ready to publish.

`package.json` identifies Musica Mathematica as `0.1.0-alpha.1`, `private`, and
`UNLICENSED`. This repository has no publication permission or project license
until its maintainer chooses one.

## Recorded local evidence

On 2026-08-14, ESLint, TypeScript, 180 Vitest tests, and the Vite production
build completed in the local working tree. Those results are historical local
evidence, not proof for a release revision.

The application is browser-local. It is not a hosted service, gradebook, LMS,
calibrated instrument, or validated assessment. Audio behavior, browser
permissions, storage, and codec support remain device- and browser-dependent.

## Required before publication

1. Select a license and publication posture.
2. Freeze and review an exact candidate revision.
3. Run `pnpm verify` on the exact candidate revision.
4. Run the configured CI workflow for that revision.
5. Deploy and test the static bundle at its intended HTTPS origin, including
   cache policy and security headers.
6. Define and test deployment and rollback procedures.
7. Confirm the canonical repository location and any external research-link or
   publication metadata.

Keyboard and screen-reader review, Firefox and Safari testing, microphone
permissions, representative audio hardware, and deployment behavior remain
unverified.
