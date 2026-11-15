import { lstat, readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// Cloudflare Pages: https://developers.cloudflare.com/pages/platform/limits/
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20_000;

export async function validateCompactSnapshot(directory) {
  const root = path.resolve(directory);
  const json = async name => JSON.parse(await readFile(path.join(root, name), "utf8"));
  const report = await json("publication-report.json");
  const analyses = await json("analyses.json");
  const scenes = await json("scenes.json");
  if (report.delivery?.mode !== "compact" || report.delivery.visualization_only !== true) throw new Error("Missing compact visualization provenance");
  if (report.analysis_count !== 17 || analyses.items?.length !== 17 || analyses.total !== 17 || scenes.items?.length !== 19 || scenes.total !== 19) throw new Error("Public snapshot must contain all 17 analyses and 19 scenes");
  if (!report.files || typeof report.files !== "object" || Object.keys(report.files).length === 0) throw new Error("Missing compact file hashes");
  for (const [name, hash] of Object.entries(report.files)) {
    const filename = path.resolve(root, name);
    if (!filename.startsWith(root + path.sep) || name.includes("\\") || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid compact inventory entry");
    const contents = await readFile(filename);
    if (createHash("sha256").update(contents).digest("hex") !== hash) throw new Error(`Compact checksum mismatch: ${name}`);
    if (name.endsWith(".json") || name.endsWith(".geojson")) {
      const value = JSON.parse(contents);
      const paths = [];
      const visit = node => {
        if (typeof node === "string" && node.startsWith("/data/compact/api/v1/")) paths.push(node);
        else if (node && typeof node === "object") Object.values(node).forEach(visit);
      };
      visit(value);
      for (const address of paths) {
        const relative = address.slice("/data/compact/api/v1/".length);
        if (!(relative in report.files)) throw new Error(`Unpublished compact link: ${address}`);
      }
    }
  }
  for (const analysis of analyses.items) {
    const id = analysis.analysis_id;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid published analysis ID");
    for (const file of [
      `analyses/${id}.json`, `analyses/${id}/statistics.json`, `analyses/${id}/evidence.json`,
      `analyses/${id}/story.pt.json`, `analyses/${id}/story.en.json`, `analyses/${id}/layers.json`,
      `analyses/${id}/environmental-context.json`, `analyses/${id}/validation.json`,
      `analyses/${id}/artifacts/change-candidates.geojson`,
    ]) {
      if (!(file in report.files)) throw new Error(`Incomplete public analysis: ${file}`);
    }
  }
  return { analyses: analyses.items.length, scenes: scenes.items.length };
}

export async function validateStaticExport(directory, { requiredRoutes = true } = {}) {
  const root = path.resolve(directory);
  let files = 0, bytes = 0, largest = { path: "", bytes: 0 };
  async function walk(folder) {
    for (const name of await readdir(folder)) {
      const filename = path.join(folder, name);
      const relative = path.relative(root, filename).split(path.sep).join("/");
      const stat = await lstat(filename);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic link is not a public asset: ${relative}`);
      if (/(?:^|\/)(?:\.env(?:\..*)?|\.netrc|_worker\.js|functions|\.git)(?:\/|$)|\.(?:h5|hdf5|pem)$/i.test(relative)) {
        throw new Error(`Forbidden public asset: ${relative}`);
      }
      if (stat.isDirectory()) await walk(filename);
      else {
        if (!stat.isFile()) throw new Error(`Not a regular asset: ${relative}`);
        files += 1; bytes += stat.size;
        if (stat.size > MAX_ASSET_BYTES) throw new Error(`Asset exceeds 25 MiB: ${relative} (${stat.size} bytes)`);
        if (stat.size > largest.bytes) largest = { path: relative, bytes: stat.size };
      }
    }
  }
  await walk(root);
  if (files > MAX_FILES) throw new Error(`Export exceeds ${MAX_FILES} files`);
  if (requiredRoutes) {
    for (const file of ["index.html", "pt/index.html", "en/index.html", "404.html", "vendor/maplibre-gl-worker.mjs"]) {
      await access(path.join(root, file));
    }
    const entry = await readFile(path.join(root, "index.html"), "utf8");
    if (!entry.includes('href="/pt/"') || !entry.includes('href="/en/"') || !entry.includes("<noscript>")) {
      throw new Error("Static entry must include PT/EN links and a no-script explanation");
    }
    await validateCompactSnapshot(path.join(root, "data/compact/api/v1"));
  }
  return { files, bytes, largest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateStaticExport(process.argv[2] ?? "out");
  console.log(`Static export verified: ${result.files} files, ${result.bytes} bytes; largest ${result.largest.path} (${result.largest.bytes} bytes).`);
}
