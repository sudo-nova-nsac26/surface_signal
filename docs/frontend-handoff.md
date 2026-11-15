# Front-end handoff (2026-11-14)

Everything a new person or AI needs to continue the web app in `frontend/` without asking. Written at the end
of a long working session; the owner is moving to another assistant. Read `AGENTS.md` first (rules, architecture,
roadmap), then this file (state, decisions, pitfalls, next tasks). Keep both current.

## 1. The project in one paragraph

SurfaceSignal is Sudo Nova's entry for the NASA Space Apps Challenge 2026 ("Dancing with the SARs", NISAR radar).
The web app tells, in plain Portuguese/English and with strong accessibility, what NISAR radar saw around
Lajeado and Estrela (Taquari Valley, Rio Grande do Sul) in the July 2026 flood (passes 2026-07-11 and 2026-07-23).
Audience: older adults, deaf and hard-of-hearing people, anyone non-technical; judges read it too.
Submission closes **Sunday 2026-11-15 23:59** (owner's time). Team: Mateus (backend, @matbdev), Yuri (front-end
owner, @korolkoo), Arthur (@arthurhfassina). Org: https://github.com/sudo-nova-nsac26 (repo `surface_signal`).

## 2. How to work with the owner

- Speaks Portuguese; answer in Portuguese, keep it plain. Has not used Docker; no Docker needed for the front-end.
- **Always ask before any `git push`**, then push only the feature branch and say what went up. Commit locally
  without asking. Small Conventional Commits. Never touch `main`/`develop` directly. Scan what you stage for
  secrets (the repo is public). Do not push `backup/historico-antigo` if it exists locally.
- Git flow: `feature/*` -> `develop` -> `main`, draft PRs. Open PR: **#6 `feature/frontend-guided-map` -> `develop`**
  (earlier PRs #1-#5 were merged by Mateus).
- The owner iterates visually and watches screen recordings. They are precise about motion: **no fades for the
  2D/3D switch, no zoom-out-then-in, the intro only zooms in**. Match their wording; test motion by tracing values.
- Report honestly what was and was not tested. Only state results you saw.
- The owner said: front-end must be 100% and **ready for the real data**; deploy, public repo + licence, English
  submission texts and the 7-slide demo are with the other team members for now (do not spend time on them
  unless asked). Front-end was estimated at ~70% done on 2026-11-14.

## 3. Where things are

```text
frontend/                      Next.js 16 + TypeScript + Tailwind 4 + MapLibre GL 6
  src/app/[lang]/              pages (/pt, /en); layout has fonts, header, footer
  src/components/map/          MapStage (whole first screen), MapView (MapLibre), places.ts (tree + locked places),
                               Timeline, ComparePanel, hardware.ts (3D vs 2D at start)
  src/components/              header, language switch, accessibility menu, HowItWorks, RegionStatus, Reveal
  src/data/                    the only data door (source.ts), API types, region/timeline logic
  src/i18n/dictionaries/       pt.ts defines the shape, en.ts must match
  src/preferences/             text size, contrast, motion (3 levels)
  public/data/api/v1/          static snapshot of the backend API (real AOI + real 19-scene catalog + 1 sample)
  public/data/boundaries/      IBGE outlines (Brazil, RS) with credits
docs/api-contract.md           backend API (Mateus). The front-end mirrors it in src/data/api-types.ts
docs/real-data-execution.md    how Mateus processes the real NISAR data
AGENTS.md                      rules + architecture + status + roadmap
```

Run: `cd frontend && npm install && npm run dev` (http://localhost:3000). Before a commit: `npx tsc --noEmit`,
`npm run lint`, `npm run build`. Read `frontend/node_modules/next/dist/docs/` before using a Next.js API.

## 4. What exists now (all on PR #6, map only, no real data)

Intro with a turning globe; "Start" zooms the globe in on Brazil and keeps it there. Place tree
World > Country > State > Region of the state; bright dots open places, dark dots are locked places; strong
outlines around the current country/state. 2D by default; 2D/3D switch (`unfold` in MapView: projection tied to
zoom for 1.5 s, glow sequenced with `fadeGlow`: out first when going to 2D, in last when going to 3D). 3D close-up
has exaggerated relief, elevation tint and free rotate/tilt (middle-mouse drag, Shift+wheel, buttons). Start view
chosen by device check + 1.5 s fps probe (`hardware.ts`, 40 fps is an estimate). Timeline stepper over the 17
comparisons the catalog allows (prev/next/slider/play). `ComparePanel`: Before/After buttons + slider that fade the
change shapes in, and layer switches (water interactive; vegetation/slopes shown with honest "not available").
Header: logo + Poppins wordmark (logo links to `/<lang>` = reload), sliding PT/EN switch, accessibility button.
"How it works" (4 steps, draggable before/after line in the drawing) ends with "Continue" that scrolls to the next
section. Below the map: sticky section menu, 01 How it works, 02 Layers, 03 Region, 04 Data sources, 05 FAQ,
"Em caso de cheia" (199/193/SMS 40199 as plain, non-clickable cards on purpose + WhatsApp share), each with an
"Ouvir" read-aloud button. "Sobre nós" in the
header and footer opens https://sudonova.surfacesignal.earth/ in a new tab.

## 5. Decisions already made (do not re-litigate)

- Front-end is independent of the backend code (backend work started pre-event: eligibility risk). It reads the
  backend's API shapes only. Data goes through `src/data/source.ts` (API mode if `NEXT_PUBLIC_API_BASE_URL` is set,
  otherwise the bundled snapshot). Components never read files or build API URLs.
- No "alert"/"risk" wording; always the "not an official alert" notice; unmeasured values are `null`, never 0;
  anything not real is labelled illustrative. Layers: water main, vegetation exploratory, slopes unavailable.
- Visual identity: Sudo Nova palette (space navy, cyan, white, amber). The earlier Rio Grande do Sul flag colours
  were dropped. Wordmark font is Poppins Bold (matches the SurfaceSignal logo).
- Map stack: MapLibre direct (no react-map-gl), OpenFreeMap tiles, Mapzen terrain on AWS, no API keys.
- Before/after is a fade of the change shapes, not a swipe (a swipe needs a second map: too heavy for weak phones).
- Timeline step = one pass compared with the previous pass of the same kind (same track/frame/direction...).

## 6. Pitfalls found the hard way

- MapLibre `easeTo` stops the previous move and stopping fires `moveend`: never restart an animation from `moveend`
  without a re-entrancy guard (it froze the page once; see `spin`).
- Do not re-apply projection/terrain on every camera change: it interrupts flights. `applied` ref tracks them.
- `cameraForBounds` frames differently for globe and flat map; use `frameBounds` so a 2D/3D switch ends on the
  final view with no second zoom.
- Basemap country codes (`adm0_l`) only exist from zoom 5, so outlines are bundled GeoJSON, not tile filters.
- Dev server can serve stale CSS: restart `npm run dev` if styles look old.
- Testing in the built-in browser: a hidden or covered pane throttles rendering (animations stall, screenshots time
  out). Set `document.documentElement.style.scrollBehavior='auto'` to test scrolling. In dev, `window.__map` is the
  MapLibre instance: trace `getZoom()` / `getProjection()` / `getSky()` over time instead of trusting screenshots.
  A tab that froze must be closed and replaced.
- Windows "reduce animations" makes the browser report `prefers-reduced-motion`; the site then uses *gentle* motion
  (short move, no unfold). The accessibility switch overrides the device setting.

## 7. Known gaps (unverified or unfinished)

- Nothing real is measured yet. Only the 11 Jul -> 23 Jul step has an analysis and it is a synthetic sample with
  an empty `change-candidates.geojson`, so the map does not change when stepping the timeline or sliding
  Before/After. That is expected, not a bug (the panel says so). Other 16 steps say "not prepared yet".
- Not tested: real weak phone, mobile layout of the latest features (timeline, compare panel, language switch),
  high contrast and English on the new panels, auto-play of the timeline, the 2D fallback on a weak device,
  the real backend (only a stand-in server was used), opening directly in 3D on a real strong device end to end.
- Radar previews (`before-preview.png` / `after-preview.png`) are not wired: raw grey, not georeferenced; ask the
  owner whether to show them.
- Root `README.md` still describes the frontend as a Vite app on port 5173.

## 8. Next tasks, in order

1. **Landmarks + "Onde estou".** At the valley close-up: buttons "Centro de Lajeado", "Ponte Lajeado-Estrela",
   "Centro de Estrela" that fly the camera there; a GPS button that only centres the map (never sent anywhere,
   ask permission, explain it). Put landmark names in both dictionaries; coordinates in `places.ts` or a new data
   file.
2. **Accessibility extras.** VLibras widget (PT only, official government widget). "Ouvir" exists for the page
   sections; the map info card does not have it yet. WhatsApp share is done.
3. **Polish and checks.** Mobile layouts of timeline/compare/language switch, high contrast, English, keyboard and
   screen reader on map controls, a real weak phone, auto-play of the timeline, 2D fallback.
4. **When data exists** (owner agrees a deadline with Mateus; ask for the 11 Jul -> 23 Jul pair first, needs an
   Earthdata account and ~180 GB free, `history run`): check the timeline and compare panel against real
   analyses, show real numbers (changed area) with `null` handled, make the timeline read as a story in plain
   words, decide about radar previews.
5. **Only if time is left:** the 3 availability states (analysis / catalog / no pair) for other regions; a 2nd cut
   in the same NISAR pair (Muçum / Roca Sales / Encantado, or Arroio do Meio / Cruzeiro do Sul).
6. **Others own for now:** deploy (Vercel works as is; Mateus's `ci/firebase-hosting` assumes a static
   `frontend/dist` that Next.js does not produce), public repo + licence (Apache-2.0 suggested), English submission
   texts, 7-slide English demo (<= 7 slides or <= 30 s video), AI-use declaration (README credits + the form),
   FortiGuard classification of the site.

## 9. Submission facts worth remembering

Judging criteria: Impact, Creativity, Validity, Relevance, Presentation. Project page needs English text; demo is
<= 7 slides or <= 30 s video, linked publicly. At least one NASA dataset must be used (NISAR via ASF counts). AI use
is allowed but must be declared; generated images need a visible watermark and may not use NASA branding. No images
or voices of people under 18. Content submitted must be open source (OSI licence; Apache-2.0 if none is chosen).

## Backend MVP handoff — 2026-11-15

The backend now prepares all 17 real comparisons from the existing 19-scene history.
No map, timeline, comparison panel or visual component was rebuilt. Existing `source.ts`
continues to support API and static modes with the original Analysis fields and water artifact.
Install the full external static bundle at `public/data/api/v1` or configure
`NEXT_PUBLIC_API_BASE_URL`. The old synthetic snapshot is preserved under `public/data/demo/api/v1`.
New general layers, statistics, PT/EN stories, regional overview and timeline are ready for
future UI wiring using the documented endpoints; the existing visual layer controls still
reflect their earlier water-focused implementation. Do not imply that general layers have
already been wired into those controls. See static-publication.md and backend-mvp.md.

## Environmental context handoff — 2026-11-15

The additive environmental data contract is now implemented in `context/models.py` and OpenAPI.
`source.ts` supports the five context routes in API and static modes; `environmental.ts` handles
numbers, Brasília display time, UTC event filtering and report integrity. The `useEnvironmental`
hook aborts obsolete requests and keys state by area/analysis. `EnvironmentalContextPanel` adds
compact expandable PT/EN facts, missing/loading/error states, citations, validation and a separate
event list; `EnvironmentalSources` distinguishes the inventory from actual comparison sources.
Map references use an independent `env-reference` outline, an allowlisted internal URL and a
2 MB/5,000-feature ceiling. The backend currently publishes reference summaries without overlays.
No map camera/projection/terrain operation was added to the environmental UI.

Run `node --test tests/environmental.test.mjs`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
The small generated report in `tests/fixtures/` is synthetic and used only for tests. Live external
sources still require operator imports and product terms. See `environmental-data-integration.md`.

Environmental events also decorate the existing timeline with distinct station/reference symbols and rainfall bands. Visual groups use UTC day/category; individual records stay in the panel. `environmentalMarkers` does not mutate events or comparison steps.

## Public static revision — 2026-11-15

The current handoff is `frontend-environmental-handoff.md`. The default data root is
`/data/compact/api/v1`; all published comparisons are bundled. Full data is optional,
installed under `/data/api/v1` and selected via `NEXT_PUBLIC_STATIC_SNAPSHOT=full`.
Next now exports to `out/`, has local fonts and a static language entry. Proxy is
removed. `npm start` previews `out/` without a Next/Python server. Cloudflare Pages
is the publication target; no production deployment was performed in this change.
