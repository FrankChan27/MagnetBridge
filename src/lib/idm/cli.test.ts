import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIdmArgs, formatIdmCommand } from "./cli.ts";

describe("IDM official CLI builder", () => {
  it("emits documented flags for an immediate silent download", () => {
    assert.deepEqual(
      buildIdmArgs({
        url: "http://127.0.0.1:9/token/0/file.bin",
        localPath: "C:\\Downloads",
        fileName: "file.bin",
      }),
      ["/n", "/d", "http://127.0.0.1:9/token/0/file.bin", "/p", "C:\\Downloads", "/f", "file.bin"],
    );
  });

  it("can queue without starting", () => {
    const args = buildIdmArgs({ url: "https://example.com/a", queueOnly: true, silent: false });
    assert.deepEqual(args, ["/d", "https://example.com/a", "/a"]);
  });

  it("rejects non-HTTP URLs including magnet", () => {
    assert.throws(() => buildIdmArgs({ url: "magnet:?xt=urn:btih:abc" }), /HTTP/);
  });

  it("quotes paths with spaces", () => {
    const cmd = formatIdmCommand("C:\\Program Files\\Internet Download Manager\\IDMan.exe", {
      url: "http://127.0.0.1/x",
      localPath: "C:\\My Files",
    });
    assert.match(cmd, /^"C:\\Program Files\\Internet Download Manager\\IDMan.exe"/);
    assert.match(cmd, /\/p "C:\\My Files"/);
  });
});
