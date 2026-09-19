import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCampaignImagePrompt } from "./image-prompt";

describe("buildCampaignImagePrompt", () => {
  it("keeps brand, brief, and the no-text rule in the prompt", () => {
    const prompt = buildCampaignImagePrompt({
      brandName: "Loopwave",
      oneLiner: "Audio that disappears.",
      brief: "Launch the Aero Case Pro.",
      keyMessage: "Thirty more hours, same case in your pocket.",
      primaryColor: "#1A2B3C",
      secondaryColor: "#F4EDE4",
      toneWords: ["grounded", "precise"],
    });

    assert.match(prompt, /Loopwave/);
    assert.match(prompt, /Aero Case Pro/);
    assert.match(prompt, /do not render as text/);
    assert.match(prompt, /#1A2B3C/);
    assert.match(prompt, /grounded, precise/);
  });
});
