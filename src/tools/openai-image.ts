import { z } from "zod";
import { env } from "@/env";

const TIMEOUT_MS = 120_000;

const OpenAIImageResponseSchema = z.object({
  data: z
    .array(
      z.object({
        b64_json: z.string().min(1).optional(),
        url: z.string().url().optional(),
      }),
    )
    .min(1),
});

export type GeneratedImage = {
  bytes: Buffer;
  model: string;
  size: "1024x1024";
  ms: number;
};

export function isImageGenerationConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY && env.IMAGE_MODEL);
}

/**
 * One GPT Image 1.5 generation at 1024×1024 via the OpenAI Images API.
 * Fetch only — no extra SDK. Agents never call this; the orchestrator does.
 */
export async function generateOpenAIImage(prompt: string): Promise<GeneratedImage> {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.IMAGE_MODEL;
  if (!apiKey || !model) {
    throw new Error(
      "OPENAI_API_KEY and IMAGE_MODEL must be set to generate images (see .env.example).",
    );
  }

  const size = env.IMAGE_SIZE ?? "1024x1024";
  const started = Date.now();

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality: "medium",
      output_format: "jpeg",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenAI image generation failed (${res.status}): ${body.slice(0, 400)}`,
    );
  }

  const parsed = OpenAIImageResponseSchema.parse(await res.json());
  const first = parsed.data[0];
  if (!first) {
    throw new Error("OpenAI image response had no images");
  }

  let bytes: Buffer;
  if (first.b64_json) {
    bytes = Buffer.from(first.b64_json, "base64");
  } else if (first.url) {
    const img = await fetch(first.url, { signal: AbortSignal.timeout(30_000) });
    if (!img.ok) {
      throw new Error(`Failed to download generated image (${img.status})`);
    }
    bytes = Buffer.from(await img.arrayBuffer());
  } else {
    throw new Error("OpenAI image response had no b64_json or url");
  }

  return { bytes, model, size, ms: Date.now() - started };
}
