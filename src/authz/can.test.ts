import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can } from "./can";
import type { WorkspaceRole } from "@/shared/types";

const roles: WorkspaceRole[] = ["viewer", "editor", "admin", "owner"];

describe("can", () => {
  it("lets every role read", () => {
    for (const role of roles) {
      assert.equal(can(role, "read"), true);
    }
  });

  it("blocks viewers from mutate, approve, and publish", () => {
    assert.equal(can("viewer", "mutate"), false);
    assert.equal(can("viewer", "approve"), false);
    assert.equal(can("viewer", "publish"), false);
  });

  it("lets editors mutate, approve, and publish", () => {
    assert.equal(can("editor", "mutate"), true);
    assert.equal(can("editor", "approve"), true);
    assert.equal(can("editor", "publish"), true);
    assert.equal(can("editor", "invite"), false);
    assert.equal(can("editor", "load_demo"), false);
  });

  it("lets admin and owner invite and load demo", () => {
    assert.equal(can("admin", "invite"), true);
    assert.equal(can("owner", "invite"), true);
    assert.equal(can("admin", "load_demo"), true);
    assert.equal(can("owner", "load_demo"), true);
  });
});
