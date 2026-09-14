# Release status

Musica Mathematica is an unreleased alpha. Lessons, the interface, and the
stored-data format may change. The package is marked `private` and
`UNLICENSED`; no project license or support policy has been selected.

The [Pages demo](docs/DEPLOYMENT.md) runs the application with synthetic example
data. It is published through a manual workflow. Check the workflow's deployment
result to see whether a particular revision is live.

## What has been tested

The automated suite covers model calculations, portfolio handling, and browser
flows in Chromium, Firefox, and WebKit, including keyboard navigation. The
commands and test scope are documented in [Contributing](CONTRIBUTING.md).

A supported release still needs manual screen-reader review and testing with
representative browsers, microphones, codecs, and devices at the deployed
HTTPS address. Browser tests alone do not establish that coverage. Classroom
effectiveness has not been evaluated, and the app does not provide calibrated
measurement or validated assessment.

## Preparing a supported release

Choose a license and support policy, review the candidate revision, and verify
that revision locally, in CI, and at its deployed address. The
[deployment guide](docs/DEPLOYMENT.md) covers publishing and rollback.
