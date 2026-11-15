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

## The map is the page

The first screen is a map that fills the window
([`MapStage.tsx`](src/components/map/MapStage.tsx)). It opens behind an
introduction; "Start" clears the screen and leaves the map with a few quiet
controls around its edges. It uses [MapLibre GL JS](https://maplibre.org/) with
services that need no key or account.

- **Places are a tree** ([`places.ts`](src/components/map/places.ts)): world,
  country, state, region of the state. Each place shows a bright
  dot for every place that can be opened; tapping it flies the camera there.
- **Places still to come** are listed in `UPCOMING` and shown as dark dots
  that cannot be opened. Moving one into `buildPlaces` opens it.
- Dots are real buttons laid over the map, so they work with keyboard and
  screen readers. The same moves are offered as buttons in the info card,
  with a breadcrumb to go back up.
- **2D is the default**: a flat map, light on slow devices. A 2D / 3D switch
  at the top turns on the globe and the 3D relief.
- **Mouse**: scrolling over the map zooms it. At the 3D close-up, holding the
  mouse wheel (or the right button) and dragging rotates and tilts, as in a
  CAD viewer; Shift + scroll rotates. Small buttons on the right edge do the
  same. Elsewhere rotation is off, so nobody loses their bearings.
- **Touch**: one finger keeps scrolling the page; two fingers move the map.
- **Motion has three levels** (`useMotionLevel`): full (the camera flies and the
  intro globe turns), gentle (the device asks for less motion: one short,
  smooth move, no sweeping flights, no spinning) and none (the visitor turned
  motion off here: the camera jumps). The switch in the accessibility menu
  wins over the device setting, so motion can be turned back on.
- **3D or 2D from the start** ([`hardware.ts`](src/components/map/hardware.ts)):
  while the introduction is on screen, the page checks what the device
  reports (WebGL 2, software graphics drivers, memory, cores, data saver,
  phone or computer) and then watches how smoothly it draws for 1.5 seconds.
  A device that passes opens in 3D; any other opens in 2D, and a line under
  "Start" says which and why in plain words. The visitor's own choice on the
  2D / 3D switch always wins. Nothing about the device is stored or sent.
- **2D <-> 3D** is one continuous zoom: the projection is tied to the zoom for a
  moment, so the globe flattens into the map (or curves back) while the camera
  moves half a zoom step. Both views frame each place with the same formula, so
  nothing zooms a second time afterwards.
- **Opening**: a slowly turning globe sits behind the introduction. "Start"
  fades the introduction while the camera pulls back to the flat map.
- The outline of the analysed area comes from the data layer.
- **Strong outline around the current place**: each place in `places.ts` can carry
  an `outline` (a bundled GeoJSON in `public/data/boundaries`: Brazil and
  Rio Grande do Sul). It is drawn as a bright line over a soft glow.
- **The world is framed on Brazil** (`focus` in `places.ts`), so the country of
  the story is in front in both 2D and 3D; other continents stay visible at
  the edges with dark locked dots.
- **Before and after** ([`ComparePanel.tsx`](src/components/map/ComparePanel.tsx)): at the valley
  close-up, "Antes" / "Depois" buttons and a slider fade the chosen comparison's change shapes in. Layer
  switches list water (the only one with data), vegetation and slopes with their honest status.
  With no shapes (the bundled sample) the controls are disabled and a note says why.
- **Timeline** ([`Timeline.tsx`](src/components/map/Timeline.tsx)): a stepper over the
  comparisons the catalog allows (each pass against the previous pass of the
  same kind). Buttons, a slider and play move forward and back. A step with a
  prepared analysis draws that analysis' `change-candidates.geojson` on the map;
  the others say they are not prepared yet. River bulletins from the analyses
  are shown on the matching day. Real results appear with no code change.
- **Opening**: the map is created only when the browser is idle, so the page
  paints first. On "Start" the introduction sinks back and blurs while the
  globe moves to the centre and grows, then the view settles into the map.
- Sections below the map rise into view as they are reached.

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
- Outlines: IBGE Malhas Geográficas (CC BY 4.0);
  see `public/data/boundaries/README.md`.
- Radar data: NISAR (NASA / ISRO), distributed by the Alaska Satellite Facility DAAC.
- River status: Serviço Geológico do Brasil (SGB).
- Built with Next.js, React and Tailwind CSS.

Parts of this code and text were produced with the support of AI tools
(Claude) and reviewed by the team.
