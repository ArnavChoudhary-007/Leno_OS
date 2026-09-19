import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { client } from "@/db/client";
import {
  getCampaign,
  getCampaignInWorkspace,
  insertCampaign,
} from "@/db/queries/campaigns";
import { workspaces } from "@/db/schema";
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import {
  getWorkspaceBySlug,
  LOCAL_WORKSPACE_SLUG,
} from "@/db/queries/workspaces";

describe("campaign workspace scoping", () => {
  let otherWorkspaceId: string | undefined;
  let otherCampaignId: string | undefined;

  it("does not return another workspace's campaign", async () => {
    const local = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
    assert.ok(local, "local workspace from 0004 backfill is required");

    const [other] = await db
      .insert(workspaces)
      .values({
        name: "Other workspace",
        slug: `test-idor-${crypto.randomUUID()}`,
      })
      .returning();
    otherWorkspaceId = other.id;

    const campaign = await insertCampaign({
      workspaceId: other.id,
      createdBy: "test",
      brief: "This brief is long enough to satisfy the campaign insert path.",
    });
    otherCampaignId = campaign.id;

    const hidden = await getCampaignInWorkspace(local.id, campaign.id);
    assert.equal(hidden, null);

    const visible = await getCampaignInWorkspace(other.id, campaign.id);
    assert.ok(visible);
    assert.equal(visible.id, campaign.id);

    const raw = await getCampaign(campaign.id);
    assert.ok(raw);
  });

  after(async () => {
    if (otherCampaignId) {
      const { campaigns } = await import("@/db/schema");
      await db.delete(campaigns).where(eq(campaigns.id, otherCampaignId));
    }
    if (otherWorkspaceId) {
      await db.delete(workspaces).where(eq(workspaces.id, otherWorkspaceId));
    }
    await client.end();
  });
});
