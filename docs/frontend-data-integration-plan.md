# Front-end: connecting the real data (plan and status)

Written 2026-11-15 by the AI that did this work, for the next person or AI. It says what is done, what was
decided, what I was going to do next and why. Read `AGENTS.md` (rules) and `docs/frontend-handoff.md`
(project, owner, pitfalls) first. Branch: `feature/frontend-data-integration`.

## 1. Where things stand

The map now reads the **real backend results** (Mateus's MVP, PRs #7 and #9): 19 real scenes, 17 real
comparisons of the Taquari Valley, in two acquisition groups (descending pass track 53, ascending pass track
103). Nothing is simulated any more on the map; the only illustrations left are in the "How it works" drawing,
and its caption says so.

What a visitor sees at the Taquari close-up:

- A compact **time bar** (bottom): a menu of 5 featured comparisons, previous/next, dates, play, and a month
  ruler with only the reachable passes.
- A **right panel**: a plain-words summary built from backend numbers (changed km2, % of the analysed area,
  possible water, football pitches as an everyday size), three layer cards (Água, Sinal mais fraco, Sinal mais
  forte) that turn each layer on and off, a "show the changes" switch, and the "real result, not yet checked on
  the ground" note last.
- A **left card**: where you are, the legend of the dashed circle (the analysed area) and three topics
  (Entender esta comparação, Outras camadas, Detalhes técnicos) that open **below themselves inside the card**
  and scroll (`ComparisonInfo.tsx`).
- On the map: signal increase (orange), decrease (blue) and possible open water (light blue), a dashed circle
  for the analysed area, gentle glints running down the Rio Taquari inside that circle (only with full motion,
  not on weak devices) and 3D relief with a filter that removes wrong elevation points.
- The camera, gestures, dots and navigation buttons are **locked during transitions** (2D/3D, flights).
- A **dev-only lab** at `/pt/lab` (404 in production) shows any of the 17 comparisons with sizes and timings.

## 2. How to run it with the real data

The data bundle (~142 MB, 68 GeoJSON) is **not in Git** (the backend team keeps it outside on purpose).

1. Get the `.tar.gz` and its `.sha256` from the team and verify it (`sha256sum`).
2. Extract so that its `api/v1/` folder becomes `frontend/public/data/api/v1/` (git-ignored).
3. `cd frontend && npm install && npm run dev`, open http://localhost:3000/pt .
4. API mode instead: set `NEXT_PUBLIC_API_BASE_URL` (the backend's address) and allow the front-end origin in
   the backend's CORS. Not tested end to end by me: the API only runs on Mateus's machine.

The synthetic sample is kept in `public/data/demo/api/v1/` and must NOT come back as an automatic fallback
(backend decision). If the bundle is missing, the map shows a plain message and "Tentar de novo".

Deploy: the host must serve the static bundle and **compress GeoJSON** (gzip/br). Raw files are 0.6 to 11 MB,
gzip makes them about 7 times smaller. Check the host's size limits (142 MB).

## 3. Decisions to keep

- Data enters only through `src/data/source.ts`. Components never build URLs. New resources: overview,
  timeline, statistics, layers, story, in API and static modes (`.pt.json` / `.en.json`).
- The guided story shows a curated set of **5 comparisons from one acquisition group** (`src/data/featured.ts`):
  before (29 Jun to 11 Jul), during (11 to 23 Jul, the start), after (23 Jul to 16 Aug), largest signal increase
  (9 to 21 Sep), largest decrease (21 Sep to 3 Oct). Never mix groups or invent a continuous trend. "Largest"
  means area, never severity.
- Honest words. `null` is "indisponível", never 0. Increase/decrease describe the radar signal, not damage.
  We do **not** say "deslizamento" or "terra molhada": the backend does not detect landslides (ground motion is
  unavailable) and a signal change cannot tell wet from dry. The "Possível: água, umidade ou plantas" line
  comes from the backend's own alternative explanations.
- The before/after fade was removed: it never compared two satellite images. Now "Mostrar as mudanças" shows
  or hides the patches, and the copy says the background map is current.
- The analysed area (dashed circle) cannot be changed in the browser: every result was computed inside that
  5 km buffer. A new area means new backend processing.
- Never build a "total changed area" by summing comparisons (the backend forbids it).
- The radar previews (`before-preview.png`, `after-preview.png`) are not georeferenced and are not in the repo:
  do not use them.

## 4. Things I learned

- A **hidden Browser pane freezes map animations and CSS transitions** (the map looks stuck on the intro, and
  the camera never reaches the valley). Show the pane first (`mcp__ccd_view__show_pane` with `preview`, after
  `preview_start`) before judging motion. For data checks, read the page state instead of screenshots.
- The dev server can serve stale CSS. Restart `npm run dev` if a new rule seems ignored.
- MapLibre custom protocol `cleandem://` (`clean-dem.ts`) fixes isolated wrong points in the free elevation
  tiles (a bridge read as a +257 m tower). It only touches zoom 10 to 13 and falls back to the original tile.
- Fast clicking on the timeline never showed an old answer: each pick cancels the previous requests.
- The bundle has extra files not used yet: `local-analysis.*.json` and `preparation.*.json` (plans for residents
  and municipal teams). Today their actions are generic ("Organizar a preparação") and need human review, and
  the territorial crossing is empty (`local_relations: null`). Do not show them as advice yet.

## 5. What is left, in order

1. **Make the data more expressive** (owner: "só vejo a água, e pouco expressivo"). Ideas that stay honest:
   show where a change repeats across the comparisons of one group, let the visitor step through a group and see
   the water patches grow and shrink, summarise per comparison. Ask Mateus which new layers he can deliver
   (vegetation, soil moisture, urban context are "em estudo" with no map today).
2. **Section 02 "Camadas"** of the page still lists the old fixed layers (water, vegetation, slopes). It should
   read the backend's layer/capability list (`/capabilities`, `/layers`) and show the real status of each.
3. **Regional overview** from `/areas/{id}/overview`: observed period, number of scenes/comparisons, groups,
   last observation. Distinguish the configured area from the valid area of each comparison.
4. **Empty and error states** across the page (no observations, no compatible pair, not processed, analysis
   with no candidates, layer unavailable, temporary failure). The map and timeline already have loading and
   retry; the rest of the page does not.
5. **"How it works" impact pins** ("Casas atingidas", "Ponte danificada", "Terra deslizou") promise more than
   the backend measures. Owner decision pending: reword them as examples of what a flood can cause, or replace
   them with what we really map.
6. **Phones and weak devices**: layout of the bottom sheet and the left accordion, dialog-free reading, real
   phone performance (the biggest comparison transfers ~1.5 MB and draws ~3,800 polygons), 2D fallback.
7. **Accessibility pass**: keyboard order on the new controls, screen reader labels on the time bar and cards,
   high contrast, English review of every new text.
8. Later (owner said these come after): landmarks and "Onde estou", VLibras, read-aloud in the map card.

## 6. Definition of done for this integration

Navigation through the featured comparisons keeps map, dates, numbers and explanation in sync in PT and EN;
no stale answer after quick clicks; loading, empty and error states; `npm run lint` and `npm run build` pass;
the bundle is installed correctly in the publishing environment; checked on a phone.
