import sharp from "sharp";
import {
  generateCarouselSlideSvg,
  type CarouselBrand,
} from "@/creative/carousel-svg";
import { INSTAGRAM_CAROUSEL_SPEC } from "@/agents/platforms/instagram-rules";

/** Matches the `slide-3` segment of /api/images/{id}/instagram/slide-3. */
const SLIDE_SEGMENT = /^slide-(\d+)$/;

/**
 * Reads the 1-based slide number out of a URL segment. Returns null for
 * anything else, so the route can 404 without touching the database.
 */
export function parseSlideSegment(segment: string): number | null {
  const match = SLIDE_SEGMENT.exec(segment);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * Renders one carousel slide to JPEG at Instagram's 4:5 feed size.
 *
 * sharp rasterises the SVG through librsvg, which has no access to web
 * fonts — Outfit and Inter fall back to whatever the host has. The layout
 * holds either way because every text node is anchored, not flowed.
 */
export async function renderSlideJpeg(options: {
  slideNumber: number;
  totalSlides: number;
  title: string;
  copy: string;
  brand: CarouselBrand;
  kind?: "hook" | "content" | "cta";
}): Promise<Buffer> {
  const svg = generateCarouselSlideSvg(options);

  return sharp(Buffer.from(svg))
    .resize(INSTAGRAM_CAROUSEL_SPEC.width, INSTAGRAM_CAROUSEL_SPEC.height, {
      fit: "cover",
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/** First slide is the hook, last is the CTA, everything between is content. */
export function slideKindFor(
  index: number,
  total: number,
): "hook" | "content" | "cta" {
  if (index === 0) return "hook";
  if (index === total - 1) return "cta";
  return "content";
}

/**
 * Splits one slide's text into a title and supporting copy. The writer
 * produces a single line per slide, so the first sentence becomes the
 * headline and the rest is the body.
 */
export function slideTitleAndCopy(text: string): {
  title: string;
  copy: string;
} {
  const trimmed = text.trim();
  // [\s\S] rather than the `s` flag: the tsconfig target predates it.
  const match = /^([\s\S]+?[.!?])\s+([\s\S]*)$/.exec(trimmed);
  if (match && match[1].length <= 60) {
    return { title: match[1].trim(), copy: match[2].trim() };
  }
  if (trimmed.length <= 60) return { title: trimmed, copy: "" };
  return { title: "", copy: trimmed };
}
