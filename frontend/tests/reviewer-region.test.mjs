import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const region = readFileSync(path.resolve("src/components/RegionStatus.tsx"), "utf8");
const dictionaries = ["pt", "en"].map((lang) =>
  readFileSync(path.resolve("src/i18n/dictionaries", lang + ".ts"), "utf8"),
);

test("reviewer statistics use only prepared comparison values", () => {
  assert.match(region, /loadComparisonDetail\(/);
  assert.match(region, /region\.comparison\.analysisId/);
  assert.match(region, /g\?\.valid_area_km2/);
  assert.match(region, /g\?\.discarded_components/);
  assert.match(region, /w\?\.candidate_area_km2/);
  assert.doesNotMatch(region, /112[.,]905|165[.,]430|3[.,]64 km²|780[.,]786|14[.,]785/);
  assert.doesNotMatch(region, /"\-3\.50 dB"|"\+0\.17 dB"|"1\.188"/);
  assert.doesNotMatch(region, /\?\?\s*"[^"]*(?:px|dB|km²)[^"]*"/);
  assert.doesNotMatch(region, /"5e434ec81b10578ba7ba6dfb"/);
});

test("no default classification of a selected radar pair as a confirmed flood", () => {
  assert.doesNotMatch(region, /Evento de Cheia|Flood Event|telemetria científica completa|full scientific telemetry/i);
  assert.match(region, /labels\.validationNote/);
  assert.match(region, /state\.region\.comparison\?\.illustrative/);
  for (const text of dictionaries) {
    assert.doesNotMatch(text, /Os desenhos no mapa ainda são exemplos|The shapes on the map are still examples/);
    assert.match(text, /noMetrics:/);
    assert.match(text, /validationNote:/);
  }
});
