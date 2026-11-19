import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { can } from "@/authz/can";

describe("mutation authorization contracts", () => {
  it("guards both previously unprotected endpoints before resource access", async () => {
    for (const [route, lookup] of [
      ["drafts/[id]/revise/route.ts", "getDraftInWorkspace(ctx.workspaceId"],
      ["campaigns/[id]/retry/route.ts", "getCampaignInWorkspace(ctx.workspaceId"],
    ]) {
      const source = await readFile(new URL(`../app/api/${route}`, import.meta.url), "utf8");
      assert.match(source, /export const runtime = "nodejs"/);
      assert.ok(source.indexOf("await authorizeMutation(request") >= 0);
      assert.ok(source.indexOf("await authorizeMutation(request") < source.indexOf(lookup));
      assert.ok(source.indexOf(lookup) > 0);
    }
    const helper = await readFile(new URL("./mutation.ts", import.meta.url), "utf8");
    assert.match(helper, /assertSameOrigin\(request\)/);
    assert.match(helper, /await requireAuthContext\(\)/);
    assert.match(helper, /requireCan\(ctx, action\)/);
    assert.match(helper, /await consumeRateLimit/);
  });

  it("requires an authentication guard on every private API route", async () => {
    const root = fileURLToPath(new URL("../app/api/", import.meta.url));
    const routes: string[] = [];
    async function discover(directory: string): Promise<void> {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const filename = join(directory, entry.name);
        if (entry.isDirectory()) await discover(filename);
        else if (/^route\.tsx?$/.test(entry.name)) routes.push(filename);
      }
    }
    await discover(root);
    assert.ok(routes.length >= 10);
    for (const filename of routes) {
      const route = relative(root, filename).replaceAll("\\", "/");
      if (route === "health/route.ts") continue;
      const source = await readFile(filename, "utf8");
      assert.match(source, /export const runtime = "nodejs"/, route);
      assert.match(source, /await (requireAuthContext\(\)|authorizeMutation\(request)/, route);
      if (/export async function (POST|PATCH|PUT|DELETE)\b/.test(source) && !source.includes("await authorizeMutation(request")) {
        assert.match(source, /requireCan\(ctx, /, route);
        assert.match(source, /assertSameOrigin\(request\)/, route);
      }
    }
  });

  it("allows only owner/admin invitation creation and denies viewer mutations", async () => {
    for (const action of ["mutate", "approve", "publish", "invite"] as const) assert.equal(can("viewer", action), false);
    assert.equal(can("editor", "invite"), false);
    assert.equal(can("admin", "invite"), true);
    assert.equal(can("owner", "invite"), true);
    const source = await readFile(new URL("../app/api/workspace/invites/route.ts", import.meta.url), "utf8");
    assert.match(source, /authorizeMutation\(request, "invite"\)/);
    assert.match(source, /createHash\("sha256"\)/);
  });
});
