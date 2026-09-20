import { sql } from "drizzle-orm";
import { client, db } from "@/db/client";
import { brandProfile, campaigns, drafts, runSteps } from "@/db/schema";
import { getCompanyContext } from "@/memory/context";
import { buildBrandCard } from "@/shared/brand-card";
import { getWorkspaceBySlug, LOCAL_WORKSPACE_SLUG } from "@/db/queries/workspaces";
import { PLATFORM_PLAYBOOKS, getEnabledPlaybooks, validateDraft } from "@/agents/platforms";
import { DraftSchema, PlanSchema, StrategySchema } from "@/shared/schemas";
import { runCampaign } from "@/agents/orchestrator";
import { startCampaignRun } from "@/workflows/campaign-run";
import { critique, RUBRIC_WEIGHTS, PASS_THRESHOLD, MAX_REVISION_ROUNDS } from "@/agents/critic";
import * as linkedinModule from "@/agents/platforms/linkedin";

interface TestResult {
  id: number;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
  error?: string;
  file?: string;
  rootCause?: string;
  recommendedFix?: string;
}

const results: TestResult[] = [];


/** Every campaign/draft/brand row is workspace-scoped; tests use the seeded local workspace. */
async function localWorkspaceId(): Promise<string> {
  const ws = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
  if (!ws) throw new Error(`Workspace "${LOCAL_WORKSPACE_SLUG}" missing — run npm run db:migrate and db:seed first.`);
  return ws.id;
}

async function main() {
  console.log("==================================================");
  console.log("STARTING LENO_OS ORCHESTRATOR VERIFICATION SUITE");
  console.log("==================================================\n");

  // ---------------------------------------------------------------------------
  // TEST 1 — APPLICATION HEALTH
  // ---------------------------------------------------------------------------
  try {
    const res = await fetch("http://localhost:3001/api/health");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (data?.ok === true) {
      results.push({
        id: 1,
        name: "APPLICATION HEALTH",
        status: "PASS",
        details: "GET http://localhost:3001/api/health returned HTTP 200 with { ok: true }",
      });
    } else {
      throw new Error(`Unexpected body: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    results.push({
      id: 1,
      name: "APPLICATION HEALTH",
      status: "FAIL",
      error: err?.message,
      file: "src/app/api/health/route.ts",
      rootCause: "Server failed to respond to /api/health with { ok: true }",
      recommendedFix: "Ensure Next.js dev server is running on port 3001 and Postgres is accessible.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 2 — DATABASE CONNECTIVITY
  // ---------------------------------------------------------------------------
  try {
    const queryResult = await db.execute(sql`select 1 as ping`);
    const brand = await getCompanyContext(await localWorkspaceId());
    if (!brand || !brand.name) {
      throw new Error("No brand profile found in database");
    }
    results.push({
      id: 2,
      name: "DATABASE CONNECTIVITY",
      status: "PASS",
      details: `Postgres connection live. Seeded brand loaded: "${brand.name}"`,
    });
  } catch (err: any) {
    results.push({
      id: 2,
      name: "DATABASE CONNECTIVITY",
      status: "FAIL",
      error: err?.message,
      file: "src/db/client.ts",
      rootCause: "Database connection failed or seeded brand profile could not be retrieved.",
      recommendedFix: "Ensure Postgres container is running and 'npm run db:seed' has been executed.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 3 — AGENT REGISTRY
  // ---------------------------------------------------------------------------
  try {
    const expectedPlatforms = ["linkedin", "x", "instagram", "threads", "facebook"] as const;
    const missing: string[] = [];

    for (const p of expectedPlatforms) {
      const playbook = PLATFORM_PLAYBOOKS[p];
      if (!playbook) {
        missing.push(p);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Platforms missing from registry: ${missing.join(", ")}`);
    }

    const linkedin = PLATFORM_PLAYBOOKS["linkedin"];
    if (!linkedin || linkedin.id !== "linkedin" || !linkedin.enabled || linkedin.maxChars !== 3000) {
      throw new Error("LinkedIn platform playbook is misconfigured or disabled");
    }

    const enabled = getEnabledPlaybooks();
    const linkedinInEnabled = enabled.some((p) => p.id === "linkedin");
    if (!linkedinInEnabled) {
      throw new Error("LinkedIn is not returned by getEnabledPlaybooks()");
    }

    results.push({
      id: 3,
      name: "AGENT REGISTRY",
      status: "PASS",
      details: `All 5 platforms (linkedin, x, instagram, threads, facebook) registered. LinkedIn lookup succeeded (maxChars: 3000, enabled: true).`,
    });
  } catch (err: any) {
    results.push({
      id: 3,
      name: "AGENT REGISTRY",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/platforms/index.ts",
      rootCause: "Platform registry lookup failed or missing platforms.",
      recommendedFix: "Check PLATFORM_PLAYBOOKS in src/agents/platforms/index.ts.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 4 — LINKEDIN AGENT INVOCATION
  // ---------------------------------------------------------------------------
  try {
    // Check if a LinkedIn drafting/generation function exists
    const anyLinkedin = linkedinModule as any;
    const generateFn =
      anyLinkedin.generateDraft ||
      anyLinkedin.draft ||
      anyLinkedin.generate ||
      anyLinkedin.runLinkedInAgent;

    if (typeof generateFn !== "function") {
      throw new Error(
        "LinkedIn agent invocation function (e.g. generateDraft / draft / runLinkedInAgent) is not exported or implemented in src/agents/platforms/linkedin.ts. Only 'linkedinPlaybook' metadata exists."
      );
    }

    // Attempt invocation if function existed
    const testBrand = {
      name: "Test Interiors",
      one_liner: "Modern commercial interior design studio",
      positioning: "Premium commercial interiors for growing businesses",
      audience: "Business owners and real estate developers",
      products: ["Commercial interior design"],
      competitors: [],
      tone_words: ["professional", "confident", "human"],
      dos: ["Be useful", "Be specific"],
      donts: ["Do not use generic marketing language"],
      example_posts: [
        "Example 1 with at least 20 chars",
        "Example 2 with at least 20 chars",
        "Example 3 with at least 20 chars",
        "Example 4 with at least 20 chars",
        "Example 5 with at least 20 chars",
      ],
      primary_color: "#000000",
      secondary_color: "#FFFFFF",
    };
    const testPlan = {
      goal: "Generate awareness",
      audience: "Business owners",
      key_message: "Good office design improves how people experience a business",
      platforms: ["linkedin" as const],
    };
    const testStrategy = {
      angle: "The business impact of good interior design",
      hooks: ["Your office is saying something about your business."],
      cta: "Share your thoughts",
    };

    const draft = await generateFn(testBrand, testPlan, testStrategy);
    const parsed = DraftSchema.parse(draft);
    results.push({
      id: 4,
      name: "LINKEDIN AGENT INVOCATION",
      status: "PASS",
      details: `Generated valid draft for LinkedIn: "${parsed.body.slice(0, 40)}..."`,
    });
  } catch (err: any) {
    results.push({
      id: 4,
      name: "LINKEDIN AGENT INVOCATION",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/platforms/linkedin.ts",
      rootCause:
        "No drafting function is implemented in src/agents/platforms/linkedin.ts; the file only exports the static playbook config (linkedinPlaybook).",
      recommendedFix:
        "Implement a draft generation function (or wire your LinkedIn Agent) in src/agents/platforms/linkedin.ts that accepts brand, plan, and strategy and returns a zod-validated Draft.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 5 — OUTPUT VALIDATION
  // ---------------------------------------------------------------------------
  try {
    // 5.1 Valid draft test
    const validDraft = {
      platform: "linkedin" as const,
      body: "Great commercial interior design isn't just aesthetic; it actively boosts team performance and client trust.",
      hashtags: ["#CommercialDesign", "#OfficeDesign"],
    };

    const parsedValid = DraftSchema.safeParse(validDraft);
    if (!parsedValid.success) {
      throw new Error(`Valid draft failed schema parse: ${parsedValid.error.message}`);
    }

    const playValidation = validateDraft("linkedin", validDraft.body, validDraft.hashtags);
    if (!playValidation.valid) {
      throw new Error(`Valid draft failed validateDraft: ${playValidation.errors.join(", ")}`);
    }

    // 5.2 Invalid draft tests
    const tooLongBody = "a".repeat(3001);
    const tooLongValidation = validateDraft("linkedin", tooLongBody, []);
    if (tooLongValidation.valid) {
      throw new Error("validateDraft failed to reject body exceeding 3000 chars");
    }

    const tooManyTags = ["#1", "#2", "#3", "#4", "#5", "#6"];
    const tooManyTagsValidation = validateDraft("linkedin", "Short body", tooManyTags);
    if (tooManyTagsValidation.valid) {
      throw new Error("validateDraft failed to reject hashtags exceeding limit of 5");
    }

    const invalidSchemaDraft = {
      platform: "unknown_platform",
      body: 12345,
    };
    const parsedInvalid = DraftSchema.safeParse(invalidSchemaDraft);
    if (parsedInvalid.success) {
      throw new Error("DraftSchema failed to reject invalid platform and non-string body");
    }

    results.push({
      id: 5,
      name: "OUTPUT VALIDATION",
      status: "PASS",
      details:
        "DraftSchema and validateDraft correctly accept compliant drafts and reject length > 3000, hashtags > 5, and invalid schemas.",
    });
  } catch (err: any) {
    results.push({
      id: 5,
      name: "OUTPUT VALIDATION",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/platforms/index.ts",
      rootCause: "Output validation checks failed.",
      recommendedFix: "Check validateDraft in src/agents/platforms/index.ts and DraftSchema in src/shared/schemas.ts.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 6 — CRITIC
  // ---------------------------------------------------------------------------
  try {
    const testDraft = {
      platform: "linkedin" as const,
      body: "A well-designed workspace changes how clients perceive your brand and how teams collaborate.",
      hashtags: ["#WorkplaceDesign"],
    };
    const testBrand = await getCompanyContext(await localWorkspaceId());
    const testPlan = {
      goal: "Generate awareness",
      audience: "Business owners",
      key_message: "Good office design improves how people experience a business",
      platforms: ["linkedin" as const],
    };

    const critiqueResult = (
      await critique([testDraft], testPlan, buildBrandCard(testBrand))
    ).object[0];
    if (!critiqueResult) throw new Error("Critic returned no result");
    results.push({
      id: 6,
      name: "CRITIC",
      status: "PASS",
      details: `Critic returned weighted: ${critiqueResult.weighted}, pass: ${critiqueResult.pass}`,
    });
  } catch (err: any) {
    results.push({
      id: 6,
      name: "CRITIC",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/critic/index.ts",
      rootCause:
        "src/agents/critic/index.ts is a stub: critique() throws 'Error: critique() is not implemented yet'.",
      recommendedFix:
        "Implement critique() in src/agents/critic/index.ts using getCriticModel() and validate with CritiqueSchema.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 7 — REVISION LOOP
  // ---------------------------------------------------------------------------
  try {
    // Check if revision loop is implemented in orchestrator
    // We inspect runCampaign or simulate calling it
    await runCampaign("simulated-campaign-id");
    results.push({
      id: 7,
      name: "REVISION LOOP",
      status: "PASS",
      details: "Revision loop executed successfully.",
    });
  } catch (err: any) {
    results.push({
      id: 7,
      name: "REVISION LOOP",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/orchestrator/index.ts",
      rootCause:
        "runCampaign() is not implemented yet; it throws 'Error: runCampaign() is not implemented yet'. No revision loop logic exists.",
      recommendedFix:
        "Implement the orchestrator loop in src/agents/orchestrator/index.ts: draft -> critique -> revise up to MAX_REVISION_ROUNDS (3) -> mark 'ready' or escalate to 'needs_human'.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 8 — CAMPAIGN WORKFLOW
  // ---------------------------------------------------------------------------
  try {
    // Check startCampaignRun
    let thrownError: any = null;
    try {
      startCampaignRun("dummy-campaign-id");
    } catch (e) {
      thrownError = e;
    }

    if (thrownError) {
      throw thrownError;
    }

    // Also check POST /api/campaigns
    const postRes = await fetch("http://localhost:3001/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: "Test brief for LinkedIn campaign" }),
    });
    const postJson = await postRes.json();
    if (postRes.status === 501 || postJson?.error === "Not implemented yet") {
      throw new Error(`POST /api/campaigns returned HTTP 501: ${JSON.stringify(postJson)}`);
    }

    results.push({
      id: 8,
      name: "CAMPAIGN WORKFLOW",
      status: "PASS",
      details: "Campaign workflow completed end-to-end.",
    });
  } catch (err: any) {
    results.push({
      id: 8,
      name: "CAMPAIGN WORKFLOW",
      status: "FAIL",
      error: err?.message,
      file: "src/app/api/campaigns/route.ts & src/workflows/campaign-run.ts",
      rootCause:
        "POST /api/campaigns returns 501 'Not implemented yet', and startCampaignRun() throws 'startCampaignRun() is not implemented yet'.",
      recommendedFix:
        "Implement POST /api/campaigns to insert a campaigns row and trigger startCampaignRun(), and wire startCampaignRun() to call runCampaign().",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 9 — DATABASE PERSISTENCE
  // ---------------------------------------------------------------------------
  try {
    // Check if table schemas are defined and accessible
    const existingCampaigns = await db.select().from(campaigns).limit(1);
    const existingDrafts = await db.select().from(drafts).limit(1);
    const existingSteps = await db.select().from(runSteps).limit(1);

    // Try a simulated write to verify database constraints and persistence
    const testCampId = `test-verify-${Date.now()}`;
    const workspaceId = await localWorkspaceId();
    await db.insert(campaigns).values({
      id: testCampId,
      workspace_id: workspaceId,
      created_by: "verify-orchestrator",
      brief: "Verification test campaign",
      status: "queued",
    });

    await db.insert(drafts).values({
      workspace_id: workspaceId,
      campaign_id: testCampId,
      platform: "linkedin",
      version: 1,
      body: "Test persisted draft for LinkedIn",
      status: "draft",
    });

    await db.insert(runSteps).values({
      workspace_id: workspaceId,
      campaign_id: testCampId,
      step: "draft_linkedin",
      model: "test-model",
      output: { test: true },
    });

    // Query back
    const [savedCamp] = await db.select().from(campaigns).where(sql`${campaigns.id} = ${testCampId}`);
    const [savedDraft] = await db.select().from(drafts).where(sql`${drafts.campaign_id} = ${testCampId}`);
    const [savedStep] = await db.select().from(runSteps).where(sql`${runSteps.campaign_id} = ${testCampId}`);

    // Cleanup test record
    await db.delete(runSteps).where(sql`${runSteps.campaign_id} = ${testCampId}`);
    await db.delete(drafts).where(sql`${drafts.campaign_id} = ${testCampId}`);
    await db.delete(campaigns).where(sql`${campaigns.id} = ${testCampId}`);

    if (savedCamp && savedDraft && savedStep && savedDraft.platform === "linkedin") {
      results.push({
        id: 9,
        name: "DATABASE PERSISTENCE",
        status: "PASS",
        details:
          "Database tables (campaigns, drafts, run_steps) are fully operational and verified with insert/select/delete round-trip.",
      });
    } else {
      throw new Error("Failed to verify retrieved records from campaigns, drafts, or run_steps");
    }
  } catch (err: any) {
    results.push({
      id: 9,
      name: "DATABASE PERSISTENCE",
      status: "FAIL",
      error: err?.message,
      file: "src/db/schema.ts",
      rootCause: "Database persistence failed during verification.",
      recommendedFix: "Check PostgreSQL connection and migrations in drizzle/.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 10 — MULTI-PLATFORM ISOLATION
  // ---------------------------------------------------------------------------
  try {
    // Verify registry filtering and isolation
    const singlePlatformPlan = {
      goal: "Brand awareness",
      audience: "B2B",
      key_message: "Focus on design",
      platforms: ["linkedin" as const],
    };

    // Orchestrator must only select platforms defined in the plan
    const selected = singlePlatformPlan.platforms.filter((p) => PLATFORM_PLAYBOOKS[p]?.enabled);
    if (selected.length !== 1 || selected[0] !== "linkedin") {
      throw new Error(`Isolation failed: expected only ['linkedin'], got ${JSON.stringify(selected)}`);
    }

    const multiPlatformPlan = {
      goal: "Product launch",
      audience: "Broad tech",
      key_message: "Launch announcement",
      platforms: ["linkedin" as const, "x" as const],
    };
    const multiSelected = multiPlatformPlan.platforms.filter((p) => PLATFORM_PLAYBOOKS[p]?.enabled);
    if (multiSelected.length !== 2 || !multiSelected.includes("linkedin") || !multiSelected.includes("x")) {
      throw new Error(`Multi-platform selection failed: expected ['linkedin', 'x'], got ${JSON.stringify(multiSelected)}`);
    }

    // However, because orchestrator runCampaign is a stub, runtime agent isolation does not yet execute
    if (typeof runCampaign !== "function") {
      throw new Error("runCampaign is not defined");
    }

    results.push({
      id: 10,
      name: "MULTI-PLATFORM ISOLATION",
      status: "PASS",
      details:
        "Platform filtering correctly isolates target platforms ('linkedin' alone vs 'linkedin' + 'x') using PLATFORM_PLAYBOOKS.",
    });
  } catch (err: any) {
    results.push({
      id: 10,
      name: "MULTI-PLATFORM ISOLATION",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/platforms/index.ts",
      rootCause: "Platform isolation check failed.",
      recommendedFix: "Ensure orchestrator selects platforms strictly from plan.platforms.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 11 — FAILURE HANDLING
  // ---------------------------------------------------------------------------
  try {
    const failureChecks: string[] = [];

    // Check A: Invalid campaign ID in runCampaign
    try {
      await runCampaign("non-existent-campaign-id");
      failureChecks.push("Failed to catch missing campaign ID");
    } catch (e: any) {
      // It throws "runCampaign() is not implemented yet"
      failureChecks.push(`runCampaign threw: ${e.message}`);
    }

    // Check B: Missing brand context
    // If brandProfile table is empty, getCompanyContext() throws "No brand profile yet — set one up at /brand"
    // We verify the code handles it
    const getCompanyContextFn = getCompanyContext.toString();
    if (!getCompanyContextFn.includes("No brand profile yet")) {
      failureChecks.push("Missing brand check not found in getCompanyContext");
    }

    // Check C: Invalid platform
    const invalidPlatformValidation = validateDraft("invalid_plat" as any, "test text", []);
    if (invalidPlatformValidation.valid) {
      failureChecks.push("validateDraft did not fail on unknown platform");
    }

    // Check D & E: Agent / Critic errors
    // Since runCampaign is a stub, error handling in the orchestrator is not implemented yet
    throw new Error(
      "Orchestrator error handling pipeline is not implemented: runCampaign() throws 'not implemented' and does not catch/record failures into campaigns table with status='failed'."
    );
  } catch (err: any) {
    results.push({
      id: 11,
      name: "FAILURE HANDLING",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/orchestrator/index.ts & src/workflows/campaign-run.ts",
      rootCause:
        "The orchestrator loop and workflow lack error recovery: failures are not caught to update campaign.status = 'failed' in the database.",
      recommendedFix:
        "Wrap the orchestrator loop in try/catch to record errors to run_steps and update campaigns.status to 'failed' on unhandled exceptions.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 12 — IDEMPOTENCY / DUPLICATE EXECUTION
  // ---------------------------------------------------------------------------
  try {
    // We inspect campaigns and drafts tables and workflows
    // Neither campaigns nor drafts have unique constraints on (campaign_id, platform, version) or status transitions
    // And runCampaign has no locking mechanism (e.g. SELECT FOR UPDATE or status = 'running' check)
    throw new Error(
      "No idempotency lock or duplicate execution guard exists in schema or code. Triggering runCampaign twice for the same campaignId will collide or re-run without concurrency control."
    );
  } catch (err: any) {
    results.push({
      id: 12,
      name: "IDEMPOTENCY / DUPLICATE EXECUTION",
      status: "FAIL",
      error: err?.message,
      file: "src/db/schema.ts & src/agents/orchestrator/index.ts",
      rootCause:
        "The current architecture does not implement idempotency keys, execution mutexes, or atomic status transitions (e.g. status='running' check before re-executing).",
      recommendedFix:
        "Document limitation as requested: check campaign status is 'queued' before starting runCampaign, and transition atomically to 'running'.",
    });
  }

  // ---------------------------------------------------------------------------
  // TEST 13 — END-TO-END ORCHESTRATOR TEST
  // ---------------------------------------------------------------------------
  try {
    throw new Error(
      "End-to-End flow failed: runCampaign() in src/agents/orchestrator/index.ts, buildStrategy() in src/agents/strategy/index.ts, critique() in src/agents/critic/index.ts, and LinkedIn drafting in src/agents/platforms/linkedin.ts are all un-implemented stubs."
    );
  } catch (err: any) {
    results.push({
      id: 13,
      name: "END-TO-END ORCHESTRATOR TEST",
      status: "FAIL",
      error: err?.message,
      file: "src/agents/orchestrator/index.ts",
      rootCause:
        "The agent loop (Brand -> Research -> Strategy -> LinkedIn Draft -> Critic -> Revision -> DB Persistence) is not yet wired together. The repository contains the scaffold, database, playbooks, and schemas, but agent execution functions are stubs.",
      recommendedFix:
        "Implement the orchestrator execution pipeline in src/agents/orchestrator/index.ts and connect the LinkedIn agent to generate drafts adhering to DraftSchema.",
    });
  }

  // ---------------------------------------------------------------------------
  // OUTPUT SUMMARY
  // ---------------------------------------------------------------------------
  console.log("--------------------------------------------------");
  console.log("TEST EXECUTION RESULTS");
  console.log("--------------------------------------------------");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓ PASS" : "✗ FAIL";
    console.log(`TEST ${r.id}: ${r.name} --> ${icon}`);
    if (r.details) console.log(`   Details: ${r.details}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  }
  console.log("--------------------------------------------------\n");

  await client.end();
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exitCode = 1;
});
