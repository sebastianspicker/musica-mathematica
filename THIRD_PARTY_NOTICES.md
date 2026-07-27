# Third-party notices

This inventory covers packages included in the current browser bundle. It does
not grant a license to Musica Mathematica itself. The repository remains
`UNLICENSED` until the maintainer selects a project license.

| Component | Version or source state | License | Source |
| --- | --- | --- | --- |
| `fft.js` | 4.0.4 | MIT | <https://github.com/indutny/fft.js> |
| KaTeX | 0.16.45 | MIT | <https://github.com/KaTeX/KaTeX> |
| React | 19.2.5 | MIT | <https://github.com/facebook/react> |
| React DOM | 19.2.5 | MIT | <https://github.com/facebook/react> |
| Scheduler | 0.27.0 | MIT | <https://github.com/facebook/react/tree/main/packages/scheduler> |
| Source Serif 4 (latin woff2) | Vendored subset files | SIL OFL 1.1 | <https://github.com/adobe-fonts/source-serif> |
| IBM Plex Sans (latin woff2) | Vendored subset files | SIL OFL 1.1 | <https://github.com/IBM/plex> |
| IBM Plex Mono (latin woff2) | Vendored subset files | SIL OFL 1.1 | <https://github.com/IBM/plex> |

The Vite production build copies KaTeX font files into `dist/assets/` and serves
self-hosted UI fonts from `public/fonts/` at `/fonts/…` (same origin; CSP
`font-src 'self'`). KaTeX and its font source repository identify those
materials as MIT-licensed. Source Serif 4 and IBM Plex faces are SIL Open Font
License 1.1. Vite also copies
[`public/third-party-licenses.txt`](public/third-party-licenses.txt) to the root
of every production build so the applicable runtime license texts travel with a
distributed bundle.

Development-only tools and their transitive dependencies remain recorded in
`pnpm-lock.yaml` and their installed package metadata. They are not listed here
because they are not part of the browser runtime bundle.
