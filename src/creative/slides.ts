/**
 * Split post body into carousel slides. Shared by the OG route and the
 * draft preview so slide counts never drift.
 */

const MAX_SLIDES = 5;
const TARGET_CHARS = 110;

export function splitCarouselSlides(
  body: string,
  maxSlides: number = MAX_SLIDES,
): string[] {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return [" "];

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const slides: string[] = [];
  let bucket = "";

  const flush = () => {
    if (bucket) {
      slides.push(bucket);
      bucket = "";
    }
  };

  for (const sentence of sentences.length ? sentences : [text]) {
    if (slides.length >= maxSlides - 1 && bucket) {
      // Last slide absorbs the remainder.
      bucket = `${bucket} ${sentence}`.trim();
      continue;
    }
    const next = bucket ? `${bucket} ${sentence}` : sentence;
    if (next.length <= TARGET_CHARS || !bucket) {
      bucket = next;
    } else {
      flush();
      if (slides.length >= maxSlides - 1) {
        bucket = sentence;
      } else {
        bucket = sentence;
      }
    }
    if (bucket.length >= TARGET_CHARS && slides.length < maxSlides - 1) {
      flush();
    }
  }
  flush();

  if (slides.length === 0) return [text.slice(0, TARGET_CHARS * 2)];
  if (slides.length > maxSlides) {
    const head = slides.slice(0, maxSlides - 1);
    const tail = slides.slice(maxSlides - 1).join(" ");
    return [...head, tail];
  }
  return slides;
}
