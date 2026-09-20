/**
 * Branded carousel slide SVG, ported from the instaagent repo's
 * creative/carousel_generator.py as a pure function — no Python, no model
 * call, no file writes. Used for slide previews in the UI.
 *
 * Changed from the source:
 * - Canvas is 4:5 (1080x1350), not 1:1 (1080x1080), matching
 *   PLATFORM_IMAGE_SPECS.instagram.
 * - The source drew a gradient rect then painted an opaque rect straight
 *   over it, so the gradient never showed. Only the gradient is drawn here.
 * - Long titles wrap instead of overflowing the canvas.
 * - Dropped the invalid `line-height` attribute; tspan dy does the spacing.
 */

import { INSTAGRAM_CAROUSEL_SPEC } from "@/agents/platforms/instagram-rules";

export const CAROUSEL_WIDTH = INSTAGRAM_CAROUSEL_SPEC.width;
export const CAROUSEL_HEIGHT = INSTAGRAM_CAROUSEL_SPEC.height;

export type CarouselSlideInput = {
  title: string;
  copy: string;
};

export type CarouselBrand = {
  name: string;
  /** Background. */
  primaryColor: string;
  /** Accent: rules, slide counter, progress dots. */
  secondaryColor: string;
};

type SlideKind = "hook" | "content" | "cta";

const TITLE_MAX_CHARS = 26;
const COPY_MAX_CHARS = 38;
const TITLE_MAX_LINES = 3;
const COPY_MAX_LINES = 6;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Greedy word wrap. A word longer than the limit gets its own line. */
export function wrapText(
  text: string,
  maxChars: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  return lines.length > 0 ? lines.slice(0, maxLines) : [""];
}

function slideKind(index: number, total: number): SlideKind {
  if (index === 0) return "hook";
  if (index === total - 1) return "cta";
  return "content";
}

function tspans(lines: string[], x: number, step: number): string {
  return lines
    .map(
      (line, i) =>
        `<tspan x="${x}" dy="${i === 0 ? 0 : step}">${escapeXml(line)}</tspan>`,
    )
    .join("");
}

export function generateCarouselSlideSvg(options: {
  slideNumber: number;
  totalSlides: number;
  title: string;
  copy: string;
  brand: CarouselBrand;
  kind?: SlideKind;
}): string {
  const { slideNumber, totalSlides, title, copy, brand } = options;
  const kind = options.kind ?? "content";
  const mid = CAROUSEL_WIDTH / 2;

  const bg = brand.primaryColor;
  const accent = brand.secondaryColor;

  // The hook and CTA slides get a wash of accent so the ends of the
  // carousel read differently from the middle.
  const topStop =
    kind === "content" ? `${bg}` : `${accent}${kind === "hook" ? "33" : "22"}`;

  const titleLines = wrapText(title, TITLE_MAX_CHARS, TITLE_MAX_LINES);
  const copyLines = wrapText(copy, COPY_MAX_CHARS, COPY_MAX_LINES);

  const dots = Array.from({ length: totalSlides }, (_, i) => {
    const cx = mid - (totalSlides - 1) * 12 + i * 24;
    const fill = i === slideNumber - 1 ? accent : `${accent}44`;
    return `<circle cx="${cx}" cy="1290" r="6" fill="${fill}"/>`;
  }).join("");

  const counter = `${String(slideNumber).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CAROUSEL_WIDTH} ${CAROUSEL_HEIGHT}" width="${CAROUSEL_WIDTH}" height="${CAROUSEL_HEIGHT}" role="img" aria-label="${escapeXml(`Slide ${slideNumber} of ${totalSlides}: ${title}`)}">
  <defs>
    <linearGradient id="bg${slideNumber}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${topStop}"/>
      <stop offset="100%" stop-color="${bg}"/>
    </linearGradient>
  </defs>

  <rect width="${CAROUSEL_WIDTH}" height="${CAROUSEL_HEIGHT}" fill="${bg}"/>
  <rect width="${CAROUSEL_WIDTH}" height="${CAROUSEL_HEIGHT}" fill="url(#bg${slideNumber})"/>

  <rect x="80" y="120" width="60" height="4" rx="2" fill="${accent}"/>
  <text x="80" y="176" font-family="Inter, Arial, sans-serif" font-size="18" fill="${accent}" opacity="0.65" font-weight="500" letter-spacing="2">${escapeXml(counter)}</text>

  <text x="${mid}" y="430" font-family="Outfit, Arial, sans-serif" font-size="52" fill="#ffffff" font-weight="700" text-anchor="middle">${tspans(titleLines, mid, 62)}</text>

  <text x="${mid}" y="660" font-family="Inter, Arial, sans-serif" font-size="28" fill="#ffffff" opacity="0.85" text-anchor="middle">${tspans(copyLines, mid, 42)}</text>

  <text x="${mid}" y="1230" font-family="Outfit, Arial, sans-serif" font-size="16" fill="${accent}" opacity="0.4" font-weight="600" text-anchor="middle" letter-spacing="3">${escapeXml(brand.name)}</text>

  ${dots}
</svg>`;
}

/** One SVG per slide. First is the hook, last is the CTA. */
export function generateCarouselSvgs(
  slides: CarouselSlideInput[],
  brand: CarouselBrand,
): string[] {
  return slides.map((slide, index) =>
    generateCarouselSlideSvg({
      slideNumber: index + 1,
      totalSlides: slides.length,
      title: slide.title,
      copy: slide.copy,
      brand,
      kind: slideKind(index, slides.length),
    }),
  );
}
