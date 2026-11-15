import { readdir, rm, access } from "node:fs/promises";
import { validateStaticExport } from "./validate-static-export.mjs";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

// Next copies all of public, including locally installed ignored full snapshots.
// Public compact builds explicitly exclude them. Originals are never modified.
const full = process.env.NEXT_PUBLIC_STATIC_SNAPSHOT === "full";
for (const name of await readdir("out/data")) {
  if (name === "api" && !full) {
    await rm(`out/data/${name}`, { recursive: true, force: true });
  }
}
// Backups may sit beside v1 inside api; never publish them in full mode either.
if (full) {
  for (const name of await readdir("out/data/api")) {
    if (name !== "v1") await rm(`out/data/api/${name}`, { recursive: true, force: true });
  }
}
for (const name of await readdir("out/data/compact/api")) {
  if (name.startsWith("v1.backup-")) await rm(`out/data/compact/api/${name}`, { recursive: true, force: true });
}
const snapshotRoot = full ? "out/data/api/v1" : "out/data/compact/api/v1";
for (const name of ["analyses.json", "areas.json", "scenes.json"]) await access(`${snapshotRoot}/${name}`);
const result = await validateStaticExport("out");
console.log(`Static export verified: ${result.files} files, ${result.bytes} bytes; largest ${result.largest.path} (${result.largest.bytes} bytes).`);
