/**
 * LENO OS — INSTAGRAM PLATFORM AGENT CONNECTOR
 *
 * Connects Leno OS with the Instagram Specialist Agent (instaagent).
 */

import type { PlatformPlaybook } from "./types";
import type { BrandProfile, Plan, Strategy, Draft } from "@/shared/types";
import { DraftSchema } from "@/shared/schemas";

export const instagramPlaybook: PlatformPlaybook = {
  id: "instagram",
  displayName: "Instagram",
  enabled: true,
  maxChars: 2200,
  maxHashtags: 30,
  formatNotes:
    "Caption supports multi-slide carousels (4:5 portrait) or static posts. High-converting hook, value-dense educational cards, and clear CTA with niche hashtags.",
  toneNotes: "Warm, visual, authoritative, and human. High-retention pacing with zero corporate buzzwords.",
  requiresImage: true,
  imageSpec: { width: 819, height: 1024, ratio: "4:5" },
};

const AGENT_URL = process.env.INSTAGRAM_AGENT_URL || "http://localhost:5002";

/**
 * Invokes the Instagram Specialist Agent to generate a platform-native draft.
 * Conforms strictly to Leno OS's DraftSchema ({ platform: 'instagram', body, hashtags }).
 */
export async function generateDraft(
  brand: BrandProfile | any,
  plan: Plan | any,
  strategy?: Strategy | any
): Promise<Draft> {
  try {
    const res = await fetch(`${AGENT_URL}/api/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand,
        plan,
        strategy,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return DraftSchema.parse({
        platform: "instagram",
        body: data.body,
        hashtags: data.hashtags || [],
      });
    }
  } catch (err) {
    // Graceful fallback if agent daemon is not yet running
    console.warn(`[Leno OS] Instagram Agent at ${AGENT_URL} offline, using fallback:`, err);
  }

  // Resilient fallback draft conforming to DraftSchema
  const topic = plan?.key_message || strategy?.angle || "Autonomous Multi-Agent Distribution";
  const brandName = brand?.name || "NexusAI";
  return DraftSchema.parse({
    platform: "instagram",
    body: `${strategy?.hooks?.[0] || topic}\n\nMost teams don't have a content bottleneck—they have a distribution bottleneck.\n\nSwipe through for the complete breakdown:\n• Slide 1: The Bottleneck\n• Slide 2: Decoupled Domain Agents\n• Slide 3: Typed Schema Contracts\n• Slide 4: Real-time Verification Loops\n• Slide 5: The Operating System\n\nSave this post if you are designing next-generation multi-agent architectures.`,
    hashtags: [
      `#${brandName.replace(/\s+/g, "")}`,
      "#MultiAgentSystems",
      "#SystemDesign",
      "#SoftwareArchitecture",
      "#TechFounders",
    ],
  });
}

// Aliases for orchestrator compatibility
export const draft = generateDraft;
export const generate = generateDraft;
export const runInstagramAgent = generateDraft;
