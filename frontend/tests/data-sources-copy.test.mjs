import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

// Load the real copy in each language, without requiring a Next.js runtime.
function sourceCopy(locale) {
  const filename = path.resolve("src/i18n/dictionaries", locale + ".ts");
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (id) => {
    if (id === "./environment") return { environmentPt: {}, environmentEn: {} };
    throw new Error("Unexpected dependency: " + id);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports.default.sources;
}

const expected = new Map([
  ["NISAR L2 GCOV", "https://nisar-docs.asf.alaska.edu/gcov/"],
  ["CHIRPS v3", "https://www.chc.ucsb.edu/data/chirps3"],
  ["JRC Global Surface Water", "https://global-surface-water.appspot.com/download"],
  ["ESA WorldCover 2021", "https://esa-worldcover.org/en/data-access"],
  ["Copernicus DEM GLO-30", "https://registry.opendata.aws/copernicus-dem/"],
  ["IBGE", "https://servicodados.ibge.gov.br/api/docs/malhas"],
  ["SGB / SACE Taquari", "https://sace.sgb.gov.br/bacia_taquari/"],
]);
const presentation = new Set(["OpenStreetMap", "OpenFreeMap", "MapLibre GL JS", "Mapzen Terrain Tiles", "Atkinson Hyperlegible"]);

test("PT/EN clearly credit exactly the seven science sources used in the public pilot", () => {
  for (const locale of ["pt", "en"]) {
    const copy = sourceCopy(locale);
    assert.equal(copy.items.length, expected.size);
    for (const item of copy.items) {
      assert.equal(item.url, expected.get(item.name), `${locale}: ${item.name}`);
      assert.ok(item.who && item.body && copy.sourceLink);
    }
    assert.deepEqual(new Set(copy.tools.map(item => item.name)), presentation);
    assert.ok(copy.tools.every(item => item.url.startsWith("https://")));
    assert.ok(copy.sampleBody.includes(locale === "pt" ? "não confirmação" : "not confirmed") ||
      copy.sampleBody.includes(locale === "pt" ? "não" : "not confirmed"));
  }
});

test("UI credits only unused registered integrations separately from actual scientific inputs", () => {
  const component = fs.readFileSync("src/components/environment/EnvironmentalSources.tsx", "utf8");
  const pilot = ["sgb-taquari", "chirps-v3", "jrc-gsw", "worldcover", "copernicus-dem", "ibge"];
  for (const id of pilot) assert.ok(component.includes('"' + id + '"'));
  assert.match(component, /!PILOT_CONTEXT_SOURCE_IDS\.has\(source\.source_id\)/);
  const page = fs.readFileSync("src/app/[lang]/page.tsx", "utf8");
  assert.match(page, /dict\.sources\.items\.map/);
  assert.match(page, /dict\.sources\.tools\.map/);
});

test("obsolete claim that actual change maps are only illustrative does not return", () => {
  for (const locale of ["pt", "en"]) {
    const copy = sourceCopy(locale);
    assert.doesNotMatch(copy.sampleBody, /Enquanto a medida real não fica pronta|Until the real measurement is ready/);
    assert.match(copy.realBody, /19/);
    assert.match(copy.realBody, /17/);
  }
});
