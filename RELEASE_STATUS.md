# Public-alpha candidate status

## Evidence cutoff

2026-08-14, local working tree only. The working tree contains concurrent and
uncommitted changes, so this is not evidence for an exact release revision.

## Verdict

**NOT READY TO PUBLISH.** The source-level lanes of the local gate pass, but
the complete `pnpm verify` gate is currently blocked by a missing Playwright
Chromium executable. No deployed build, release revision, or remote CI result
was checked in this evidence set.

## Candidate identity

The application identifies as `0.1.0-alpha.1`, is `private`, and is
`UNLICENSED`. No license or publication permission is implied by this file.

## Proposed alpha scope

Musica Mathematica is a browser-local teaching workbench with deterministic
music-mathematics lessons, a local portfolio, synthetic lesson input, and
optional microphone or audio-file analysis. It is not a hosted service,
gradebook, LMS, calibrated instrument, or validated assessment.

## Verified evidence

On 2026-08-14, `pnpm verify` completed the following lanes successfully in the
current working tree:

- ESLint over `src` and `tests`;
- TypeScript with no emit;
- 32 Vitest files and 180 tests; and
- the Vite production build.

The Playwright lane attempted seven Chromium workflows but each stopped at
browser launch because the pinned Chromium executable was absent. No browser
scenario reached application code, so this is an environment blocker rather
than evidence of a browser-product regression. Install the repository's pinned
browser with `pnpm exec playwright install chromium`, then rerun `pnpm verify`
to obtain local browser evidence.

The repository includes a GitHub Actions CI workflow that uses Node 22,
installs locked dependencies and Chromium system support, then runs
`pnpm verify`. It has not been confirmed here on a committed release revision.
The repository also includes screenshot assets and a local capture script, but
they were not regenerated because the required Chromium executable is absent.

## Open blockers

1. The maintainer must select a license and publication posture; the package is
   intentionally `private` and `UNLICENSED` today.
2. Establish, review, and preserve an exact release revision after concurrent
   working-tree changes settle.
3. Restore local Playwright Chromium and pass the complete `pnpm verify` gate.
4. Run CI for that exact revision and retain its result.
5. Deploy and test the static bundle at its intended HTTPS origin, including
   cache policy and HTTP security headers.
6. Define a deployment and rollback procedure. None is present in the
   repository.
7. Confirm the canonical repository location, release tag, and external
   research-link and publication metadata.

## External and Owner Evidence

- No GitHub Pages workflow is present. Pages is feasible only after adding and
  verifying a build-and-publish workflow. The current Vite output uses
  root-relative asset paths, so a project-site subpath needs an appropriate
  `base` configuration before it can be deployed there.
- Keyboard and screen-reader review, Firefox and Safari testing, microphone
  permissions, codec coverage, and representative audio hardware behavior
  remain unverified.
- Chromium is the only configured automated browser target. Local audio remains
  uncalibrated and device-dependent, and browser storage is origin-local.
- Only the version 1 to version 2 portfolio migration is supported. There is
  no server, account, roster, grading, LMS, or deployment service, and no
  accessibility-conformance, acoustic-validity, or classroom-effectiveness
  claim has been established.

## Next Gate

After the owner selects a publication posture and an exact candidate revision,
install Playwright Chromium, run `pnpm verify`, run the configured CI workflow
for that revision, then test the deployed bundle at its intended origin.
