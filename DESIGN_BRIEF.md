# Design brief: Musica Mathematica

Prepared 2 October 2026 for the redesign on branch `redesign/engraved-score`.
It builds on the September design exploration (`output/uiux-exploration-2026-09-09/`,
untracked), which recommended a sequential "guided notebook". The redesign keeps
that sequence and gives it a visual language of its own.

## 1. Product summary

Musica Mathematica is a browser-local workbench of 24 inquiry lessons in eight
music-mathematics domains: Phase & Proportion, Ensemble Dynamics, Rhythm & Meter,
Pitch & Tuning, Harmony & Geometry, Timbre & Acoustics, Probability & Form, and
Measurement & Inference. Each domain has three levels: foundation, model and
critique. A lesson moves through eight fixed stages: Orient → Predict →
Experiment → Compare → Explain → Perform → Transfer → Debrief
(`src/learning/stages.ts`).

There is no backend, account or grading. Work is saved to `localStorage`, and the
portfolio can be exported as JSON. Three lessons can analyze microphone or file
audio locally.

**Moment of value.** The learner reaches the controlled comparison. Two recorded
runs differ in exactly one factor, and the learner sees whether their committed
prediction held. In the reference lesson, Temperaments and Commas, a learner
expects 19-EDO to fit 3:2 better than 12-EDO. The comparison shows −7.22 cents
against −1.96 cents, which refutes the prediction.

## 2. Audience

**Primary audience.** University and conservatoire music students working in
theory, analysis, acoustics, composition, ensemble practice or music technology
(`PRODUCT.md`, `docs/MUSICA_MATHEMATICA_CURRICULUM.md`).

- They are fluent in notation, intervals, tempo and rehearsal practice. Their
  confidence with logarithms, modular arithmetic and model criticism varies.
- They read scores, parts, critical editions and treatises every day. Their
  sense of quality comes from engraving: clean typesetting, consistent rules,
  correct symbols and generous margins.
- They distrust gamification, edtech cheerfulness, scores and badges, and any
  suggestion that a number measures their musicianship. The product's evidence
  boundaries ("Do not infer…") exist because of this.
- They use notation software (Dorico, MuseScore, Sibelius), DAWs, IMSLP scans,
  tuners and metronomes. Many also use Desmos or a spreadsheet.

**Secondary audience.** The instructor who projects a lesson in a 60–90 minute
seminar using presentation mode. They need legibility at distance and in a
dark room. They need no administration tools.

## 3. Key journeys

1. **Choose an inquiry.** Open Lessons, scan the eight domains and their three
   levels, and pick a lesson by its question.
2. **Predict.** Read the question and equation, then commit a written
   prediction. The prediction becomes immutable once the experiment begins.
3. **Experiment.** Record Run A, change one factor while watching an unrecorded
   preview, then record Run B. Recording more runs is allowed.
4. **Compare → Explain.** Read the controlled comparison and write an
   explanation.
5. **Perform → Transfer → Debrief.** Reflect away from the screen, transfer the
   reasoning to another context, then review the whole record and export it.
6. **Return.** Open My learning to resume, export, enter presentation mode or
   clear local work.

## 4. Brand traits

| Trait | It must not tip into |
| --- | --- |
| **Scholarly**: reads like a well-edited score or critical edition | Academic stuffiness or museum pastiche |
| **Exact**: units, signs and symbols are typeset correctly | Cold dashboard or engineering console |
| **Musical**: speaks the rehearsal room's language | Kitsch: clefs, notes and piano keys used as decoration |
| **Honest**: evidence limits sit next to the result | Disclaimers that crowd out the task |
| **Calm**: one task in focus at a time | Empty minimalism that hides how far the learner has come |

## 5. Market observations

These come from category knowledge, not a live audit. No live competitor review
was done this session.

- **Theory and ear-training sites** (musictheory.net, Teoria, Hooktheory) use
  flat illustration, bright accent colours and lesson cards. They feel friendly
  but juvenile to a conservatoire student.
- **Playful sound toys** (Chrome Music Lab, Ableton's Learning Synths) are
  colourful, gestural and bold. They are wonderful for exploration but carry no
  evidential weight.
- **Science simulations** (PhET, Desmos) use toolbar chrome, sliders and graph
  paper. They are functional and look like software rather than music.
- **DAW and plug-in aesthetics** use dark panels, glowing meters and skeuomorphic
  knobs. They signal "production", not inquiry.

**Honor:** familiar form controls, explicit units, visible keyboard focus, and
the left-to-right stage sequence that teachers can refer to by number.

**Break:** cards and illustrations, the edtech palette, progress bars and
gamification, and the dark-console look.

## 6. What to keep

- **Name and wordmark.** The serif wordmark "Musica Mathematica" in the
  oxblood/rubric red (`#7c142b` family). This is the only real brand equity.
- **Warm paper and ink palette.** It suits reading and printing, and it is
  already established in screenshots and docs.
- **Source Serif 4 and IBM Plex Mono.** Both are self-hosted and OFL. Source
  Serif was previously masked by `Georgia` at the head of the font stack, so on
  macOS the app actually rendered in Georgia. That is fixed.
- **The sequential notebook structure, every route, label, class hook and
  stage.** Playwright and the unit tests pin many of them, and they are part of
  the product's accessibility.

## 7. Current weaknesses

- **Generic.** The page is warm paper with a serif, an eight-dot stepper, grey
  "pill" badges and tinted rounded boxes. Nothing says *music*.
- **Mis-set equations.** They render as raw ASCII (`f_n/f_0 = 2^(n/m)`,
  `dtheta_i/dt = omega_i + …`). For a mathematics product, this is the most
  visible craft failure.
- **Accreted CSS.** About 1,450 lines are layered as patches: `notebook.css`
  overrides `inquiry.css`, which overrides `base.css`, and there are
  `!important`s, duplicated rules and values outside any scale. Georgia sits
  ahead of the self-hosted font. Plex Sans and three serif weights load but are
  barely used.
- **Weak hierarchy.**
  - The stage title, lesson title and run titles compete at similar sizes.
  - The primary action floats centred while related controls are left-aligned.
  - The interpretation boundary is a centred caption that reads as a footer.
- **Mobile.**
  - The stage ribbon wraps into a 4×2 grid that reads as two separate sequences.
  - Readings collapse into a ragged two-column grid with stray rules.
  - The lesson identity line and Restart button wrap awkwardly.
- **Weak preview/recorded distinction.** It relies on a pink-versus-grey tint
  plus a small pill, so it is colour-led.
- **Dark mode.** It exists only as presentation mode, and the system colour
  scheme is ignored.

## 8. Constraints (load-bearing)

- **Contracts that must not change.** Hash routes, storage keys, portfolio JSON,
  ids, factor bounds, audio limits and evaluator goldens (`AGENTS.md`).
- **Pinned UI hooks.** Playwright and unit tests pin these accessible names and
  copy:
  - "Start with a prediction"
  - "Commit prediction & begin"
  - "Record Run A/B"
  - "Compare the latest two runs"
  - "Interpret…"
  - the "Save … & continue" labels
  - "Explore the model, charts and playback"
  - "Add an optional observation note"
  - "Adjust other factors"
  - "Preview · not recorded"
  - dialog names, status strings
  - the classes `.mm-stage-card`, `.mm-notebook-run--preview` and
    `--recorded`, `.mm-notebook-prediction`, `.mm-factor-inspector`,
    `.mm-result-visual__svg`, `.mm-curriculum-rail__lesson`,
    `.mm-notebook-footer .mm-global-status`, `.mm-transport-time`, `.mm-global-message`
  - the gating that hides factors and graphics before prediction
- **Layer boundaries.** `src/ui` stays presentational, with no DOM globals.
  Lint enforces this.
- **Security.** The CSP allows `font-src 'self'` and `style-src 'self' 'unsafe-inline'`,
  so there are no external fonts. Fonts must be self-hosted under the build base
  path.
- **Accessibility and layout.** WCAG 2.2 AA contrast, 44px targets, keyboard
  dialogs, focus moving to the stage heading on advance, reduced motion, print,
  and no horizontal overflow at 390px for all 24 lessons (tested).
- **Language.** English only, with no i18n framework. SEO is minimal: a single
  page plus a meta description.

## 9. Assumptions log

| # | Assumption | Evidence | Confidence |
| --- | --- | --- | --- |
| A1 | Primary users are music-trained students who read scores fluently. | `PRODUCT.md` "university and conservatoire music students"; curriculum vocabulary such as EDO, Euclidean rhythm, Tn/In and voice leading | High |
| A2 | Score-engraving conventions (rehearsal marks, staff names in the margin, system rules) read as familiar and serious to this audience, not as decoration. | Domain practice; every conservatoire student rehearses by letter or number | Medium |
| A3 | Laptops at a desk are the primary context. Phones serve review and short sessions, and a projector serves seminars. | Prior exploration; presentation mode exists; e2e tests cover 390, 768 and 1536 widths | Medium |
| A4 | Learners sometimes work at night and expect the system dark scheme to be honoured. | General platform expectations; there is no product evidence | Low. The design keeps light as the reference, and dark reuses the presentation palette. |
| A5 | Typeset equations help more than they risk misreading. | ASCII math is non-standard; italic variables, subscripts and Greek are the notation students meet in textbooks | High for the 24 known equations. The typesetter falls back to plain text for unknown syntax, and the screen-reader label keeps the source string. |
| A6 | Unrecorded preview versus recorded run maps well onto pencil versus ink. | Musicians pencil markings into parts and ink a fair copy. The UI must already distinguish "Preview · not recorded". | Medium. The text labels remain, so the metaphor is never the only cue. |
| A7 | Dropping IBM Plex Sans causes no loss. Serif plus mono carries the UI. | Plex Sans appeared only in status chips, the stage count and small labels. | High |
| A8 | Instructors project in dim rooms. The dark presentation palette plus larger type suits them. | Presentation mode already switches to dark tokens. | Medium |

---

## Design Direction

The domain offers three material worlds: the **engraved score** (what musicians
read), the **monochord and tuning table** (where music became mathematics), and
the **laboratory notebook** (where inquiry is recorded). Each of the three
directions below grows from one of them.

### Direction 1: Engraved Score

**Concept.** Each lesson is laid out like a page of a full score. The left
margin holds "staff names" (*Question*, *Prediction*, *Run A*, *Run B*,
*Boundary*), just as a score names its instruments at the start of a system.
Stages are **rehearsal marks**: boxed numerals 1–8 that teachers can call out
("we're at 4"). Hairline system rules divide the page in place of boxes or
cards. Recorded evidence is **inked**. The live preview is **pencilled**: a
graphite dashed rule with a graphite label, the way musicians pencil changes
into a part before they are confirmed.

**Fit.** It speaks the audience's daily visual language (A1, A2). It is serious
without being cold, and it makes the experiment's structure (what was held,
what changed, what was recorded) legible as the alignment of a score.

**Typography.** Source Serif 4 handles reading and display:
- 400 for text and very large titles
- 400 italic for the musical question, prompts and expression-style marginal
  labels, the way tempo and expression markings are set in italic
- 600 for small emphasis

IBM Plex Mono 400/500 sets every number, unit and rehearsal numeral. The serif
is the music; the mono is the mathematics. Equations are typeset with italic
variables, roman operators, real sub- and superscripts, Greek letters and Σ.

**Scale.** Major third (1.25), anchored at 17px body:
13.6 / 17 / 21.25 / 26.5 / 33 / 41.5 / 52 / 65px. Display titles clamp
between 41.5 and 65.

**Colour.**

| Role | Light | Dark |
| --- | --- | --- |
| Paper | `#f8f5ef` | |
| Ink | `#14151c` | |
| Rubric red (the existing oxblood): the current stage, primary actions and the changed factor | `#8a1630` | `#f0a3b3` |
| Graphite: the pencilled preview | `#5d6168` | |
| Hairline rules | warm grey `#d8d2c6` and `#a59f93` | |

Rubrication is how manuscripts marked what mattered, and early chant
manuscripts drew their staff lines in red. Status colours are a muted green for
"Saved" and an ochre for caution, always paired with an icon and words.

**Layout.**
- **Grid.** A two-column "system" on a 12-column grid: a 11rem margin for staff
  names, then content up to about 64rem. The reading measure is held to roughly
  68ch.
- **Density.** Generous vertical rhythm between systems and tight alignment
  within them. Readings are ruled columns like a tuning table.
- **Mobile.** The page becomes a single "part" rather than a score: staff names
  move above their content as italic cues, rehearsal marks become a single
  scrollable row of eight boxes with the current one named, and the primary
  action stays full width.

**Motion.** Very little:
- The current rehearsal mark fills (180ms).
- A newly current stage heading fades in (opacity, 200ms).
- Recording a run changes the pencil rule to ink.

Motion is never decorative, never on scroll, and is removed under
`prefers-reduced-motion`.

**Signature details.**
1. Rehearsal-mark stage progress: boxed numerals on a single staff line.
2. Pencil-versus-ink runs, with typeset equations as the mathematical voice.

**Against the category.** No cards, no illustration and no progress
percentages. The page looks like a page of music, not a SaaS app or a toy.

**Refuses.** Musical clip art (clefs, notes, keyboards), rounded cards with
shadows, gradients, badges and progress percentages.

### Direction 2: Monochord

**Concept.** One horizontal string runs across the top of every lesson. Its
nodes sit at harmonic divisions, and the eight stages are placed at 1/1, 8/7,
… positions along it. Results are drawn as measured lengths on a ruler. Inspired
by Boethius and the Pythagorean monochord.

**Typography.** A high-contrast display serif such as Cormorant for titles,
with a geometric grotesque for UI and tabular lining figures.

**Colour.** Brass on near-black, plus a parchment light theme.

**Layout.** Centred, axial and symmetrical, with long horizontal rulers. Low
density.

**Motion.** The string vibrates (a standing wave) when a run is recorded.

**Signature.** The string-ruler progress, and results shown as string lengths.

**Against the category.** Physical and historical rather than digital.

**Refuses.** Tables in favour of rulers.

**Weakness.** It privileges tuning: only 3 of the 8 domains are about pitch
ratios, so the metaphor breaks for probability or harmony graphs. Animated
strings border on decoration. Display-serif contrast suffers at small sizes and
on projectors.

### Direction 3: Tuning Table

**Concept.** A dense, data-first instrument modelled on historical tuning tables
(Euler, Partch) and spreadsheet ledgers. Run A and Run B sit side by side as
columns from the start. Prediction, explanation and transfer are rows in one
ledger that grows across stages.

**Typography.** A single monospaced family, Plex Mono, for everything, with
weight for hierarchy.

**Colour.** Dark ink-blue ground, off-white text, and one signal colour for the
changed factor.

**Layout.** Wide tables, with sticky first column and header. High density.

**Motion.** None, apart from row highlights.

**Signature.** The ledger that accumulates the whole inquiry. Delta columns.

**Against the category.** It deliberately looks like a research instrument.

**Refuses.** Prose-first layout.

**Weakness.** It favours mathematically confident learners, as the earlier
exploration noted of its "comparison instrument". It is hostile at 390px, makes
the reflective writing stages feel like data entry, and edges towards the dark
console cliché.

### Choice: Engraved Score

Direction 1 is the only one that:
1. fits all eight domains, because the score page is content-neutral;
2. keeps the guided, reflective sequence that the curriculum and earlier
   research favour;
3. draws on the audience's own literacy (A1, A2);
4. works on a phone as a "part" and on a projector as a "conductor's score".

It also evolves the existing palette and fonts rather than discarding them.

**What it trades away.** The monochord's visual drama and the tuning table's
simultaneous density. The comparison is still a table, but it is ruled and
aligned like a score system, and the changed factor is rubricated.

**If A2 is wrong** and learners don't read the score metaphor, nothing breaks:
- rehearsal marks still carry the stage names in text;
- staff names still work as plain labels;
- pencil and ink still carry "Preview · not recorded" and "Recorded" in words.

The metaphor adds meaning but never carries information on its own.
