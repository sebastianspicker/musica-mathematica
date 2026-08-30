# Release status

Musica Mathematica is not ready to publish. `package.json` identifies the
package as `private` and `UNLICENSED`; no project license or publication
authority is present in this repository.

The application is browser-local. It is not a hosted service, gradebook, LMS,
calibrated instrument, or validated assessment. Audio capture, permissions,
storage, codec support, and accessibility behavior vary by browser and device.

## Required before publication

1. Choose a license and publication posture.
2. Freeze and review an exact candidate revision.
3. Run `pnpm verify` and the configured CI workflow for that revision.
4. Deploy and test `dist/` at the intended HTTPS origin, including cache policy
   and response security headers.
5. Define and test deployment and rollback procedures.
6. Confirm the canonical repository location and publication metadata.

The repository does not establish completion of keyboard and screen-reader
review, Firefox and Safari testing, microphone permissions, representative
audio hardware, codec coverage, or deployed-origin behavior. These need
separate evidence for the candidate release.
