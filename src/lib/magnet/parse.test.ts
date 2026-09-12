import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMagnetInput, looksLikeMagnet } from "./parse.ts";

describe("parseMagnetInput", () => {
  it("parses hex magnet", () => {
    const parsed = parseMagnetInput(
      "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel",
    );
    assert.equal(parsed.infoHash, "08ada5a7a6183aae1e09d831df6748d566095a10");
    assert.equal(parsed.name, "Sintel");
  });

  it("accepts bare info-hash", () => {
    const parsed = parseMagnetInput("08ada5a7a6183aae1e09d831df6748d566095a10");
    assert.equal(parsed.infoHash, "08ada5a7a6183aae1e09d831df6748d566095a10");
  });

  it("rejects empty and http search URLs", () => {
    assert.throws(() => parseMagnetInput(""));
    assert.throws(() => parseMagnetInput("https://example.com/search?q=film"));
  });

  it("looksLikeMagnet", () => {
    assert.equal(looksLikeMagnet("magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10"), true);
    assert.equal(looksLikeMagnet("not a magnet"), false);
  });
});
