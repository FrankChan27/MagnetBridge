import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canTransition } from "./transitions.ts";

describe("task state machine", () => {
  it("covers the required happy path", () => {
    assert.equal(canTransition("NEW", "FETCHING_METADATA"), true);
    assert.equal(canTransition("FETCHING_METADATA", "READY"), true);
    assert.equal(canTransition("READY", "DOWNLOADING"), true);
    assert.equal(canTransition("DOWNLOADING", "VERIFYING"), true);
    assert.equal(canTransition("VERIFYING", "COMPLETED"), true);
  });

  it("allows pause/fail/cancel without deadlock", () => {
    assert.equal(canTransition("DOWNLOADING", "PAUSED"), true);
    assert.equal(canTransition("PAUSED", "DOWNLOADING"), true);
    assert.equal(canTransition("FAILED", "DOWNLOADING"), true);
    assert.equal(canTransition("FAILED", "FETCHING_METADATA"), true);
    assert.equal(canTransition("COMPLETED", "DOWNLOADING"), false);
  });
});
