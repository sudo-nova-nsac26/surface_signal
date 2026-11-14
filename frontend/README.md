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
src/data/           data layer: backend shapes, the single data door, plain-language model
src/proxy.ts        sends "/" to the visitor's language
public/data/api/v1/ snapshot of backend responses used when no backend is configured
```

## Data: one door, two sources

The site never opens raw radar files. It reads the small prepared outputs that
the SurfaceSignal backend serves, through a single module
([`src/data/source.ts`](src/data/source.ts)). No component reads a file or
builds a backend address on its own.

| Mode | When | Where data comes from |
|---|---|---|
| API | `NEXT_PUBLIC_API_BASE_URL` is set | The backend (`/api/v1/areas`, `/scenes`, `/analyses`, artifacts) |
| Static | variable not set | A snapshot of the same responses in `public/data/api/v1` |

Both modes use the exact shapes of [the API contract](../docs/api-contract.md),
typed in [`src/data/api-types.ts`](src/data/api-types.ts), so switching is
configuration only.

To use the live backend:

1. Start it from the repository root (`docker compose up --build`, or the
   Python setup in the root README).
2. Allow this site in the root `.env`:
   `SURFACESIGNAL_CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]`
3. Copy `frontend/.env.example` to `frontend/.env.local` and uncomment
   `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`.

[`src/data/region.ts`](src/data/region.ts) turns backend records into what
the interface says. It decides the state of each region from real data:

| State | Rule |
|---|---|
| `analysis` | The backend has a prepared analysis for the area. |
| `catalog` | No analysis, but two scenes are comparable (same rule as `comparable()` in the backend). |
| `no-pair` | No two comparable passes yet. |

An analysis the backend marks `synthetic` is labelled "illustrative data" in
the interface. The bundled snapshot holds the real area and the real 19-scene
catalog, plus one hand-made sample analysis marked `synthetic` with no shapes.
Unmeasured values are `null`, never zero.

Everyday names for areas live in [`src/data/area-labels.ts`](src/data/area-labels.ts);
the backend stays technical.

## The guided map

The journey from the whole planet to Lajeado and Estrela lives in
`src/components/map`. It uses [MapLibre GL JS](https://maplibre.org/) with
services that need no key or account.

- **Places are a tree** ([`places.ts`](src/components/map/places.ts)): world,
  continent, region of the country, state, valley. Each place shows a dot for
  its children; tapping a dot flies the camera there. Only the path to the
  Taquari Valley exists for now; adding a place is one entry in that file plus
  its name in the dictionaries.
- Dots are real buttons laid over the map, so they work with keyboard and
  screen readers. The same moves are offered as large buttons beside the map,
  with a breadcrumb to go back up.
- **2D is the default**: a flat map, light on slow devices. A large 2D / 3D
  switch above the map turns on the globe and the 3D relief.
- **3D relief**: terrain is exaggerated and tinted by elevation. At the
  close-up the visitor can rotate and tilt freely (buttons, two-finger drag,
  or right-button drag). Everywhere else rotation is off, so nobody loses
  their bearings.
- With "reduce motion" the camera jumps between places instead of flying.
- The map library is downloaded only when the visitor reaches that section.
- The page keeps scrolling normally: zooming needs Ctrl + scroll or two fingers.
- The outline of the analysed area comes from the data layer.

`npm run dev` and `npm run build` first copy the MapLibre worker file into
`public/vendor` (not committed).

## Accessibility

- Plain-language text; no radar jargon in the interface.
- Text size, high contrast and reduced motion controls, remembered per browser.
  The device's own "reduce motion" setting is respected automatically.
- Everything is sized in `rem`, so the text-size control scales the whole page.
- Touch targets are at least 48 px; keyboard focus is always visible.
- The look follows the Sudo Nova team palette (space navy, cyan, white and
  amber). White text on the navy background has a contrast above 17:1.
- Colour is never the only signal: layers also have an icon and a name. Layer
  colours follow the Okabe-Ito colour-blind-safe palette.
- Built for slow phones: pages are prerendered, drawings are plain SVG, and
  only `transform` and `opacity` are animated.
- Each page declares its language so screen readers use the right voice.

## Credits

- Team logo: `public/sudo-nova-logo.jpeg`, from the Sudo Nova organisation profile.
- Base map: [OpenFreeMap](https://openfreemap.org/), © OpenMapTiles, data from OpenStreetMap.
- Terrain: Mapzen terrain tiles on AWS Open Data.
- Typeface: [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/)
  by the Braille Institute (SIL Open Font License).
- Radar data: NISAR (NASA / ISRO), distributed by the Alaska Satellite Facility DAAC.
- River status: Serviço Geológico do Brasil (SGB).
- Built with Next.js, React and Tailwind CSS.

Parts of this code and text were produced with the support of AI tools
(Claude) and reviewed by the team.
