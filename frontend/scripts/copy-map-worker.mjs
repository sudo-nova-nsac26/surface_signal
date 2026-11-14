// MapLibre runs its heavy work in a separate worker file that the page must
// be able to download. This copies it from the installed package into
// public/vendor before `dev` and `build`, so it always matches the installed
// version and is never committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(
  join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs"),
  join(target, "maplibre-gl-worker.mjs"),
);
