"use client";

import { useMemo } from "react";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { splitInstagramBody } from "@/agents/platforms/instagram-rules";
import { splitCarouselSlides } from "@/creative/slides";
import type { PlatformId } from "@/shared/types";

/**
 * The post's creative: the fitted photo, a branded quote card, an
 * Instagram carousel (1080×1350 slides), or an Instagram story script.
 */
export function DraftCreative({
  draftId,
  body,
  platform,
  imageUrl,
}: {
  draftId: string;
  body: string;
  platform: PlatformId;
  imageUrl?: string | null;
}) {
  const spec = PLATFORM_PLAYBOOKS[platform]?.imageSpec;
  const name = PLATFORM_PLAYBOOKS[platform]?.displayName ?? platform;
  const quoteUrl = `/api/og/quote?draftId=${encodeURIComponent(draftId)}`;
  const instagram = useMemo(() => (platform === "instagram" ? splitInstagramBody(body) : null), [platform, body]);
  const slides = useMemo(
    () => (instagram?.slides.length ? instagram.slides : splitCarouselSlides(body)),
    [instagram, body],
  );
  const explicitCarousel = Boolean(instagram?.slides.length);
  const stories = instagram?.stories ?? [];
  const showCarousel = explicitCarousel || (!stories.length && !imageUrl && (platform === "instagram" || slides.length > 1));

  return (
    <div className="l-creative">
      {imageUrl && spec ? (
        <figure className="l-creative-fig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${name} crop`} style={{ aspectRatio: `${spec.width} / ${spec.height}` }} />
          <figcaption>
            Cropped {spec.ratio} · {spec.width}×{spec.height}
            <a href={imageUrl} download className="l-link">
              Download
            </a>
          </figcaption>
        </figure>
      ) : explicitCarousel || stories.length ? null : (
        <figure className="l-creative-fig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={quoteUrl} alt="Branded quote card" style={{ aspectRatio: "1 / 1" }} />
          <figcaption>
            Quote card
            <a href={quoteUrl} target="_blank" rel="noreferrer" className="l-link">
              Open PNG
            </a>
          </figcaption>
        </figure>
      )}

      {showCarousel ? (
        <div className="l-stack-8">
          <p className="l-faint" style={{ margin: 0, fontSize: 13 }}>
            {explicitCarousel ? "Instagram carousel" : "Carousel"} ({slides.length} slides)
            {explicitCarousel ? " - 1080 x 1350 JPEG" : ""}
          </p>
          <div className="l-carousel">
            {slides.map((_, index) => {
              const url = `/api/og/carousel?draftId=${encodeURIComponent(draftId)}&slide=${index}`;
              return (
                <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Open slide ${index + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Carousel slide ${index + 1}`}
                    className={explicitCarousel ? "aspect-[4/5]" : "aspect-square"}
                  />
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      {stories.length ? (
        <div className="l-stack-8">
          <p className="l-faint" style={{ margin: 0, fontSize: 13 }}>
            Instagram story script ({stories.length} frames)
          </p>
          <p className="l-faint" style={{ margin: 0, fontSize: 13 }}>
            Copy script exports the full script. Add interactive stickers in Instagram; they are instructions, not live
            controls.
          </p>
          <ol className="l-story">
            {stories.map((story, index) => (
              <li key={index}>{story}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
