import sharp from "sharp";
import { generateCarouselSlideSvg, type CarouselBrand } from "./carousel-svg";

export function slideTitleAndCopy(text: string): { title: string; copy: string } {
  const trimmed = text.trim();
  const match = /^([\s\S]+?[.!?])\s+([\s\S]*)$/.exec(trimmed);
  if (match && match[1].length <= 60) {
    return { title: match[1].trim(), copy: match[2].trim() };
  }
  return trimmed.length <= 60 ? { title: trimmed, copy: "" } : { title: "", copy: trimmed };
}

export async function renderInstagramSlide(
  slides: string[],
  index: number,
  brand: CarouselBrand,
): Promise<Buffer> {
  if (!Number.isSafeInteger(index) || index < 0 || index >= slides.length) {
    throw new RangeError("Slide index out of range");
  }
  const { title, copy } = slideTitleAndCopy(slides[index]);
  const svg = generateCarouselSlideSvg({
    slideNumber: index + 1,
    totalSlides: slides.length,
    title,
    copy,
    brand,
    kind: index === 0 ? "hook" : index === slides.length - 1 ? "cta" : "content",
  });
  return sharp(Buffer.from(svg)).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
