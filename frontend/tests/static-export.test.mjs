import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, truncate, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import ts from "typescript";
import { MAX_ASSET_BYTES, validateStaticExport } from "../scripts/validate-static-export.mjs";

function load(file, env = {}) {
  process.env.NEXT_PUBLIC_API_BASE_URL = env.api ?? "";
  process.env.NEXT_PUBLIC_STATIC_SNAPSHOT = env.snapshot ?? "compact";
  const filename = path.resolve(file);
  const mod = new Module(filename); mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = id => id === "./environmental" ? load("src/data/environmental.ts", env) : createRequire(filename)(id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return mod.exports;
}

test("browser language preference selects supported PT/EN without a server", () => {
  const { pickLocale } = load("src/i18n/pick-locale.ts");
  assert.equal(pickLocale(["pt-BR", "en-US"]), "pt");
  assert.equal(pickLocale(["fr", "en-GB", "pt"]), "en");
  assert.equal(pickLocale(["fr", "PT-pt"]), "pt");
  assert.equal(pickLocale([]), "en");
});

test("data root is compact by default, full only when selected, API remains independent", async () => {
  const compact = load("src/data/source.ts");
  assert.equal(compact.artifactUrl("a/b", "change-candidates.geojson"), "/data/compact/api/v1/analyses/a%2Fb/artifacts/change-candidates.geojson");
  assert.equal(compact.referenceArtifactUrl("/data/compact/api/v1/areas/a/references/x.geojson"), "/data/compact/api/v1/areas/a/references/x.geojson");
  const full = load("src/data/source.ts", { snapshot: "full" });
  assert.equal(full.artifactUrl("a", "summary.json"), "/data/api/v1/analyses/a/artifacts/summary.json");
  const api = load("src/data/source.ts", { api: "http://localhost:8000/" });
  assert.equal(api.artifactUrl("a", "summary.json"), "http://localhost:8000/api/v1/analyses/a/artifacts/summary.json");
  for (const address of ["https://user:pass@api.test", "https://api.test/?token=secret", "javascript:bad"]) assert.throws(() => load("src/data/source.ts", { api: address }));
  assert.throws(() => load("src/data/source.ts", { snapshot: "typo" }));
});

test("public asset validation rejects over-limit files, private assets and symlinks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "surfacesignal-export-"));
  try {
    const file = path.join(root, "geometry.geojson");
    await writeFile(file, "{}");
    assert.equal((await validateStaticExport(root, { requiredRoutes: false })).files, 1);
    await truncate(file, MAX_ASSET_BYTES + 1);
    await assert.rejects(validateStaticExport(root, { requiredRoutes: false }), /exceeds 25 MiB/);
    await rm(file);
    await writeFile(path.join(root, "source.h5"), "private");
    await assert.rejects(validateStaticExport(root, { requiredRoutes: false }), /Forbidden public asset/);
    await rm(path.join(root, "source.h5"));
    await symlink("/etc/passwd", path.join(root, "external"));
    await assert.rejects(validateStaticExport(root, { requiredRoutes: false }), /Symbolic link/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
