import { INSTAGRAM_CAROUSEL_SPEC } from "@/agents/platforms/instagram-rules";
import { isHexColor } from "./colors";
export const CAROUSEL_WIDTH = INSTAGRAM_CAROUSEL_SPEC.width;
export const CAROUSEL_HEIGHT = INSTAGRAM_CAROUSEL_SPEC.height;
export type CarouselSlideInput = {
  title: string;
  copy: string;
};
export type CarouselBrand = {
  name: string;
  primaryColor: string;
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
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current)
      lines.push(current);
    current = word;
    if (lines.length >= maxLines)
      break;
  }
  if (current && lines.length < maxLines)
    lines.push(current);
  return lines.length > 0 ? lines.slice(0, maxLines) : [""];
}
function slideKind(index: number, total: number): SlideKind {
  if (index === 0)
    return "hook";
  if (index === total - 1)
    return "cta";
  return "content";
}
function tspans(lines: string[], horizontal: number, step: number): string {
  return lines
    .map((line, index) => `<tspan x="${horizontal}" dy="${index === 0 ? 0 : step}">${escapeXml(line)}</tspan>`)
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
  const bg = isHexColor(brand.primaryColor) ? `#${brand.primaryColor.trim().replace(/^#/, "")}` : "#0F172A";
  const accent = isHexColor(brand.secondaryColor) ? `#${brand.secondaryColor.trim().replace(/^#/, "")}` : "#38BDF8";
  const topStop = kind === "content" ? `${bg}` : `${accent}${kind === "hook" ? "33" : "22"}`;
  const titleLines = wrapText(title, TITLE_MAX_CHARS, TITLE_MAX_LINES);
  const copyLines = wrapText(copy, COPY_MAX_CHARS, COPY_MAX_LINES);
  const dots = Array.from({ length: totalSlides }, (_, index) => {
    const cx = mid - (totalSlides - 1) * 12 + index * 24;
    const fill = index === slideNumber - 1 ? accent : `${accent}44`;
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
export function generateCarouselSvgs(slides: CarouselSlideInput[], brand: CarouselBrand): string[] {
  return slides.map((slide, index) => generateCarouselSlideSvg({
    slideNumber: index + 1,
    totalSlides: slides.length,
    title: slide.title,
    copy: slide.copy,
    brand,
    kind: slideKind(index, slides.length),
  }));
}
