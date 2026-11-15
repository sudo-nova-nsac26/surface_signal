// Builds src/components/valley-scene-data.ts for the "How it works" drawing:
// the real Taquari River, the streets of Lajeado and Estrela, main roads and
// the bridges over the river, plus house markers placed along real streets.
//
// Source: OpenStreetMap contributors (ODbL). Download from Overpass, merge the
// replies into one {"elements": [...]} file and run:
//   node scripts/build-valley-scene.mjs <osm.json> src/components/valley-scene-data.ts
// Queries used (bbox south,west,north,east):
//   water=river, waterway=river, highway trunk/primary/secondary, bridge=yes
//   in -29.53,-52.08,-29.40,-51.84; highway tertiary/residential/unclassified/
//   living_street in -29.52,-51.99,-29.445,-51.93.
//
// The map is turned so that Lajeado is on the left and Estrela on the right.
// Houses, fields and the impact spots are a drawing aid, not measurements.
import fs from "node:fs";

const [, , input, output] = process.argv;
if (!input || !output) throw new Error("usage: <osm.json> <out.ts>");
const osm = JSON.parse(fs.readFileSync(input, "utf8"));

const LAT0 = -29.4838;
const LON0 = -51.9636;
const SCALE = 0.117; // drawing units per metre
const CX = 600;
const CY = 325; // middle of the ground area (y 140 to 500)
const WINDOW = { x0: -150, x1: 1350, y0: 120, y1: 640 };
const FLOOD_REACH = 70; // drawing units from the river's centre line

const project = ({ lat, lon }) => {
  const east = (lon - LON0) * Math.cos((LAT0 * Math.PI) / 180) * 111320;
  const north = (lat - LAT0) * 110574;
  return [CX + SCALE * -north, CY - SCALE * east];
};
const inside = ([x, y]) =>
  x > WINDOW.x0 && x < WINDOW.x1 && y > WINDOW.y0 && y < WINDOW.y1;

function thin(points, gap = 1.6) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= gap) out.push(p);
  }
  const end = points[points.length - 1];
  if (out.length && out[out.length - 1] !== end) out.push(end);
  return out;
}
const fmt = (n) => Math.round(n * 10) / 10;
const toPath = (points, close) =>
  points.length < 2
    ? ""
    : `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}${close ? "Z" : ""}`;
const whole = (points) =>
  points.length < 2
    ? ""
    : `M${points.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join("L")}`;
const key = (p) => `${p.lat},${p.lon}`;

function rings(members) {
  const pieces = members
    .filter((m) => m.type === "way" && m.role === "outer" && m.geometry)
    .map((m) => m.geometry);
  const done = [];
  while (pieces.length) {
    let ring = pieces.shift().slice();
    let grew = true;
    while (grew && key(ring[0]) !== key(ring[ring.length - 1])) {
      grew = false;
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        const end = key(ring[ring.length - 1]);
        const start = key(ring[0]);
        if (key(piece[0]) === end) ring = ring.concat(piece.slice(1));
        else if (key(piece[piece.length - 1]) === end)
          ring = ring.concat(piece.slice().reverse().slice(1));
        else if (key(piece[piece.length - 1]) === start)
          ring = piece.concat(ring.slice(1));
        else if (key(piece[0]) === start)
          ring = piece.slice().reverse().concat(ring.slice(1));
        else continue;
        pieces.splice(i, 1);
        grew = true;
        break;
      }
    }
    done.push({ ring, closed: key(ring[0]) === key(ring[ring.length - 1]) });
  }
  return done;
}

const MINOR = /^(tertiary|residential|unclassified|living_street)$/;
const rivers = [];
const riverLinePts = [];
const tributaries = [];
const roads = [];
const bridgePts = [];
const streetPts = [];

for (const el of osm.elements) {
  const tags = el.tags ?? {};
  if (el.type === "relation" && tags.name === "Rio Taquari") {
    for (const { ring, closed } of rings(el.members)) {
      const pts = ring.map(project);
      if (closed && pts.some(inside)) rivers.push(toPath(thin(pts), true));
    }
  } else if (el.type === "way" && tags.waterway === "river" && tags.name === "Rio Taquari") {
    const pts = el.geometry.map(project);
    if (pts.some(inside)) riverLinePts.push(pts);
  } else if (el.type === "way" && tags.waterway && /Arroio|Rio/.test(tags.name ?? "")) {
    const pts = el.geometry.map(project);
    if (pts.filter(inside).length > 3) tributaries.push(toPath(thin(pts, 2.4)));
  } else if (el.type === "way" && tags.highway && el.geometry) {
    const pts = el.geometry.map(project);
    if (!pts.some(inside)) continue;
    if (tags.bridge === "yes") bridgePts.push(pts);
    else if (MINOR.test(tags.highway)) {
      if (pts.filter(inside).length > 2) streetPts.push(thin(pts, 2.6));
    } else roads.push(toPath(thin(pts, 2)));
  }
}

// Distance from a point to the river's centre line.
const segments = riverLinePts.flatMap((line) =>
  line.slice(1).map((p, i) => [line[i], p]),
);
function toRiver([x, y]) {
  let best = Infinity;
  for (const [[ax, ay], [bx, by]] of segments) {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

const lajeado = project({ lat: -29.4669, lon: -51.9614 });
const estrela = project({ lat: -29.5006, lon: -51.9658 });
const near = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;

// Houses: along real streets, spaced out, never inside the river.
const houses = [];
const taken = new Set();
const cell = (x, y) => `${Math.floor(x / 24)}:${Math.floor(y / 24)}`;
for (const line of streetPts) {
  for (const [x, y] of line) {
    if (x < 30 || x > 1170 || y < 180 || y > 492) continue;
    const d = toRiver([x, y]);
    if (d < 30) continue;
    const c = cell(x, y);
    if (taken.has(c)) continue;
    taken.add(c);
    const tall = (near([x, y], lajeado, 90) || near([x, y], estrela, 45)) && houses.length % 3 === 0;
    houses.push([Math.round(x), Math.round(y), d < FLOOD_REACH ? 1 : 0, tall ? 1 : 0]);
  }
}

// Bridges: only the part that crosses the river, plus a broken version.
const bridges = [];
function along(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < s) i++;
    const t = (s - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
    return [points[i - 1][0] + t * (points[i][0] - points[i - 1][0]), points[i - 1][1] + t * (points[i][1] - points[i - 1][1])];
  };
  const part = (a, b) => {
    const out = [at(a)];
    for (let i = 0; i < points.length; i++) if (lengths[i] > a && lengths[i] < b) out.push(points[i]);
    out.push(at(b));
    return out;
  };
  return { total, part, at };
}
for (const pts of bridgePts) {
  const idx = pts.map((p, i) => (toRiver(p) < 34 ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 1) continue;
  const deck = pts.slice(Math.max(0, idx[0] - 1), Math.min(pts.length, idx[idx.length - 1] + 2));
  if (deck.length < 2) continue;
  const { total, part, at } = along(deck);
  if (total < 12) continue;
  bridges.push({
    deck: toPath(deck),
    broken: [toPath(part(0, total * 0.4)), toPath(part(total * 0.6, total))],
    mid: at(total / 2).map(fmt),
    total,
  });
}

// Fields: open land with no street, house or river nearby.
const busy = new Set(houses.map(([x, y]) => `${Math.floor(x / 30)}:${Math.floor(y / 30)}`));
for (const line of streetPts) for (const [x, y] of line) busy.add(`${Math.floor(x / 30)}:${Math.floor(y / 30)}`);
const fields = [];
for (let gy = 7; gy < 16; gy++) {
  for (let gx = 9; gx < 33; gx++) {
    const free = [0, 1].every((dx) => !busy.has(`${gx + dx}:${gy}`));
    const centre = [(gx + 1) * 30, (gy + 0.5) * 30];
    if (!free || toRiver(centre) < 60) continue;
    if (fields.some((f) => near(centre, [f[0] + f[2] / 2, f[1] + f[3] / 2], 220))) continue;
    fields.push([gx * 30 + 4, gy * 30 + 4, 52, 22]);
    if (fields.length >= 2) break;
  }
  if (fields.length >= 2) break;
}

const hit = houses.filter((h) => h[2]);
const nearest = (list, target) =>
  list.reduce((best, h) => (Math.hypot(h[0] - target[0], h[1] - target[1]) < Math.hypot(best[0] - target[0], best[1] - target[1]) ? h : best), list[0]);
const streetSpot = streetPts
  .flat()
  .filter((p) => {
    const d = toRiver(p);
    return d > 40 && d < 62 && p[0] > 300 && p[0] < 900;
  });
const mainBridge = bridges.slice().sort((a, b) => b.total - a.total)[0];

const data = {
  rivers,
  riverLines: riverLinePts.map((p) => toPath(thin(p))),
  tributaries,
  roads,
  streets: [streetPts.map(whole).join("")],
  houses,
  bridges: bridges.map(({ deck, broken }) => ({ deck, broken })),
  fields,
  lajeado: lajeado.map(fmt),
  estrela: estrela.map(fmt),
  spots: {
    houses: nearest(hit, lajeado).slice(0, 2),
    streets: nearest(streetSpot, estrela).map(Math.round),
    bridge: mainBridge?.mid ?? [600, 330],
    crops: fields[0] ? [fields[0][0] + 26, fields[0][1] + 11] : [880, 440],
  },
};

const text = `// Generated by scripts/build-valley-scene.mjs. Do not edit by hand.
// Shapes: © OpenStreetMap contributors (ODbL), simplified for a drawing.
export const VALLEY = ${JSON.stringify(data)} as const;
`;
fs.writeFileSync(output, text);
console.log(
  `rivers ${rivers.length}, river lines ${riverLinePts.length}, streets ${streetPts.length}, houses ${houses.length} (hit ${hit.length}), ` +
    `bridges over the river ${bridges.length}, fields ${fields.length}, ${Math.round(text.length / 1024)} KB`,
  JSON.stringify(data.spots),
  JSON.stringify(fields),
);
