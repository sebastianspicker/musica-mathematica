# Public-alpha candidate status

Status date: 2026-07-24

## Current state

The application is version `0.1.0-alpha.1`, is marked `private`, and is
`UNLICENSED`.

The local `pnpm verify` gate passes:

- ESLint over `src` and `tests`;
- TypeScript with no emit;
- 28 Vitest files and 148 tests;
- the Vite production build; and
- seven Playwright Chromium workflows.

These results describe the current working tree. They have not been confirmed
by a remote workflow on a committed release revision.

## Publication blockers

1. Select a project license and update `package.json`.
2. Establish and review an exact release revision.
3. Run the GitHub Actions workflow against that revision.
4. Test the deployed static bundle and its HTTP security headers.
5. Confirm the canonical repository location and release tag.

## Verification still required

- Keyboard and screen-reader review.
- Firefox and Safari testing.
- Microphone permissions and audio processing on representative hardware.
- Codec coverage for supported browser platforms.
- Deployment at the intended origin and cache policy.
- External research-link and publication-metadata review before release.

## Accepted alpha limitations

- Chromium is the only automated browser target.
- Local audio remains uncalibrated and device-dependent.
- Browser storage is origin-local and can be cleared by the browser or user.
- The version 1 to version 2 portfolio copy is the only migration.
- There is no server, account, roster, grading, LMS, or deployment service.
- No accessibility-conformance, acoustic-validity, or classroom-effectiveness
  claim has been established.
