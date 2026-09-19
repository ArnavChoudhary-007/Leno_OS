import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResearchQuery, formatResearchBlock } from "./tavily-format";

describe("buildResearchQuery", () => {
  it("joins brand, message, and brief into one query", () => {
    const query = buildResearchQuery({
      brandName: "Loopwave",
      brief: "Launch the Aero Case Pro this week.",
      audience: "audio engineers",
      keyMessage: "Thirty more hours in the same pocket.",
      angle: "battery life without bulk",
      competitors: ["Sony", "Bose"],
    });
    assert.match(query, /Loopwave/);
    assert.match(query, /Aero Case Pro/);
    assert.match(query, /Sony/);
    assert.ok(query.length <= 400);
  });
});

describe("formatResearchBlock", () => {
  it("wraps sources for the LinkedIn writer and forbids invented citations", () => {
    const block = formatResearchBlock({
      query: "Loopwave Aero Case Pro",
      answer: "Launch coverage is out this week.",
      sources: [
        {
          title: "The Verge",
          url: "https://example.com/a",
          snippet: "Thirty more hours of playback.",
        },
      ],
    });
    assert.match(block, /LIVE RESEARCH \(LinkedIn\)/);
    assert.match(block, /The Verge/);
    assert.match(block, /Do not invent citations/);
  });
});
