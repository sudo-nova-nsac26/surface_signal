import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const dictionary = locale => readFileSync(
  path.resolve("src/i18n/dictionaries", locale + ".ts"), "utf8",
);

// Regression guard for reviewer-facing copy: a heuristic radar polygon
// cannot claim confirmed flood extent, damaged buildings or verified risk.
// Future translations should retain an equivalent explicit uncertainty note.
test("both landing pages identify SAR changes as unconfirmed candidates", () => {
  for (const locale of ["en", "pt"]) {
    const source = dictionary(locale);
    const hero = source.split("  hero: {")[1]?.split("  how: {")[0];
    assert.ok(hero, "Missing hero copy: " + locale);
    if (locale === "en") {
      assert.match(hero, /Candidate changes are not confirmed/i);
      assert.doesNotMatch(hero, /show how far the water reached/i);
    } else {
      assert.match(hero, /As manchas não confirmam/i);
      assert.doesNotMatch(hero, /mostrar até onde a água chegou/i);
    }
  }
});

test("land-cover narrative does not carry a hard-coded percentage between comparisons", () => {
  for (const locale of ["en", "pt"]) {
    const source = dictionary(locale);
    assert.doesNotMatch(source, /34[.,]2%|30[.,]5%|mata ciliar|riparian trees/i);
    assert.match(source, /WorldCover 2021/);
  }
});
