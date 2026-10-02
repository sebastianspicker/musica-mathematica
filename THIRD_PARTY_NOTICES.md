# Third-party notices

The browser bundle includes the libraries and fonts below. Their licenses
apply to those components. Musica Mathematica itself is still `UNLICENSED`.

| Component | Version or files | License | Source |
| --- | --- | --- | --- |
| `fft.js` | 4.0.4 | MIT | <https://github.com/indutny/fft.js> |
| React | 19.2.5 | MIT | <https://github.com/facebook/react> |
| React DOM | 19.2.5 | MIT | <https://github.com/facebook/react> |
| Scheduler | 0.27.0 | MIT | <https://github.com/facebook/react/tree/main/packages/scheduler> |
| Source Serif 4 | Latin and Greek WOFF2 subsets | SIL OFL 1.1 | <https://github.com/adobe-fonts/source-serif> |
| IBM Plex Mono | Latin WOFF2 subsets | SIL OFL 1.1 | <https://github.com/IBM/plex> |

Fonts are included in [public/fonts/](public/fonts/) and served from the same
origin as the app. Their URLs use the build's base path: `/fonts/` for a root
build and `/musica-mathematica/fonts/` for the Pages demo.

The full runtime license texts are in
[public/third-party-licenses.txt](public/third-party-licenses.txt). Vite copies
that file to the root of each production build.

Development tools are listed in [pnpm-lock.yaml](pnpm-lock.yaml) and their
installed package metadata. They are not included in this table because they
do not ship in the browser bundle.
