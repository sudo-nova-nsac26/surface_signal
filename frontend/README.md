# SurfaceSignal — web app

The public face of SurfaceSignal: a bilingual (Portuguese / English) site that
shows, in plain language, what the NASA-ISRO NISAR radar observed around Lajeado
and Estrela (Taquari Valley, Brazil) during the July 2026 flood.

It is designed first for people who are usually left out of scientific
dashboards: older adults, people who are deaf or hard of hearing, and anyone
with no technical background. It is **not** an alert system.

## Run it

Requires Node.js 20 or newer. No Docker, API keys or database.

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The address redirects to `/pt` or `/en` according
to the browser language.

Other commands: `npm run build` (production build), `npm run lint`.

## How it is organised

```text
src/app/[lang]/     pages, one tree per language (/pt, /en)
src/components/     interface pieces (header, language switch, accessibility menu, icons)
src/i18n/           languages and the text dictionaries (pt.ts is the reference shape)
src/preferences/    accessibility preferences saved in the visitor's browser
src/data/types.ts   shapes of the prepared data files
src/proxy.ts        sends "/" to the visitor's language
public/data/        prepared data the site reads (see below)
```

## Data: the site never opens raw radar files

NISAR products are several gigabytes each. An offline step turns a pair of
scenes into a few small files, and the site only reads those:

```text
public/data/regions.json                      regions and what is available for each
public/data/analyses/<analysis-id>/summary.json   dates, scene IDs, layer status, context, sources
public/data/analyses/<analysis-id>/<layer>.geojson change shapes for a layer (when available)
```

The exact shapes are documented in [`src/data/types.ts`](src/data/types.ts).
Replacing the sample files with real outputs needs no code change.

While `summary.json` has `"illustrative": true`, shapes are hand-made samples
used to build the interface, and the site labels them as illustrative data.
Unmeasured values are `null`, never zero.

Each region is in one of three states:

| State | Meaning |
|---|---|
| `analysis` | A prepared before/after comparison exists and is shown. |
| `catalog` | The satellite has comparable scenes, but they were not processed yet. |
| `no-pair` | There are not two comparable passes for that place yet. |

## Accessibility

- Plain-language text; no radar jargon in the interface.
- Text size, high contrast and reduced motion controls, remembered per browser.
  The device's own "reduce motion" setting is respected automatically.
- Everything is sized in `rem`, so the text-size control scales the whole page.
- Touch targets are at least 48 px; keyboard focus is always visible.
- Colour is never the only signal: layers also have an icon and a name. Layer
  colours follow the Okabe-Ito colour-blind-safe palette.
- Each page declares its language so screen readers use the right voice.

## Credits

- Typeface: [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/)
  by the Braille Institute (SIL Open Font License).
- Radar data: NISAR (NASA / ISRO), distributed by the Alaska Satellite Facility DAAC.
- River status: Serviço Geológico do Brasil (SGB).
- Built with Next.js, React and Tailwind CSS.

Parts of this code and text were produced with the support of AI tools
(Claude) and reviewed by the team.
