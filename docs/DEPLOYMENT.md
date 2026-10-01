# Deployment

Musica Mathematica builds to static files that you can serve over HTTPS. Choose
the Pages build for a seeded demo or the root build for an empty learner
notebook. Neither needs a server process, database, or runtime credentials.

## GitHub Pages demo

The [Pages workflow](../.github/workflows/pages.yml) builds an interactive
example under `/musica-mathematica/`. It runs only when dispatched manually.
Ordinary pushes run CI without deploying.

Before deployment, run `pnpm verify` and `pnpm test:e2e` for the intended
revision, as described in [Contributing](../CONTRIBUTING.md#tests-and-verification).
The browser tests build both the root app and the Pages demo. The Pages
workflow itself runs `pnpm typecheck` and `pnpm test:unit` before building.

### Publish to Pages

1. Include the workflow and its source changes on the repository's default
   branch. GitHub requires the workflow there for manual dispatch.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**
   as the source.
3. In **Actions → Deploy GitHub Pages**, choose **Run workflow** and select
   the branch to deploy. Repository write access is required; environment
   rules may require a separate approval.
4. Wait for both build and deploy jobs, then open the URL shown by the
   deployment. Check the demo comparison, lesson navigation, and browser
   console at that HTTPS address.

These steps follow GitHub's documentation for
[Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
and [manual workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

For this repository, the project-site address is
<https://sebastianspicker.github.io/musica-mathematica/>. Use the successful
deployment's URL to check the live site; the workflow file alone does not mean
the site has been published.

### Preview locally

Build and serve the demo as described in
[Contributing](../CONTRIBUTING.md#preview-the-pages-demo). The demo starts with a
prediction and a controlled 90-to-120 BPM comparison. All lessons remain
interactive. In **My learning**, choose **Reset demo data** and confirm to
restore the example.

The example contains no real learner data. Demo changes are saved under
`musicaMathematica.demo.learning.v2`. The demo adapter cannot read, migrate,
overwrite, or clear the ordinary `musicaMathematica.learning.v2` or legacy
`ensembleCouplingLab.learning.v1` records.

### Forks and custom paths

A fork with the same repository name can keep the existing Pages base path.
If you rename it, change `pagesBase` in [vite.config.ts](../vite.config.ts)
to `/<repository-name>/`. Update the Pages base in
[playwright.config.ts](../playwright.config.ts), the README demo link, and the
screenshot preview URL to match, then rerun the build and browser tests.

For a Pages site served at an origin root, use `/` as the Pages base and update
the test and preview URLs accordingly. Using Pages mode preserves the demo
seed and its separate storage namespace.

## Other static hosts

Run `pnpm build` and serve `dist/` at the origin root over HTTPS. This build
opens an empty learner notebook and uses the ordinary portfolio namespace.
Hash-based lesson routes do not require a server-side route fallback.

Review the Content Security Policy in [index.html](../index.html) along with
your host's response headers and caching policy. HTML cannot configure those
headers or caching. On Pages, GitHub controls them. The policy allows
same-origin resources and, for Vite development, loopback WebSocket
connections.

## Rollback

To roll back, rebuild and redeploy a known working source
revision through the same workflow or host. This replaces application files;
it does not restore learner data. Check portfolio compatibility before
deploying an older version.
