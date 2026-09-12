import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeFileName, sanitizeRelativePath, uniqueName } from "./sanitize.ts";

describe("windows path sanitization", () => {
  it("strips illegal characters and reserved names", () => {
    assert.equal(sanitizeFileName("aux.txt"), "_aux.txt");
    assert.equal(sanitizeFileName("a<b>|c?.mp4").includes("<"), false);
  });

  it("drops parent segments", () => {
    assert.equal(sanitizeRelativePath("foo/../../etc/passwd"), "foo/etc/passwd");
  });

  it("avoids collisions", () => {
    const used = new Set<string>();
    const a = uniqueName("file.txt", used);
    const b = uniqueName("file.txt", used);
    assert.equal(a, "file.txt");
    assert.equal(b, "file (2).txt");
  });
});
