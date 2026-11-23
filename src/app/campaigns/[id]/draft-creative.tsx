"use client";

import { useMemo } from "react";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { splitCarouselSlides } from "@/creative/slides";
import type { PlatformId } from "@/shared/types";

/** The post's image: the fitted photo, or a branded quote card + carousel. */
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
  const quoteUrl = `/api/og/quote?draftId=${encodeURIComponent(draftId)}`;
  const slides = useMemo(() => splitCarouselSlides(body), [body]);
  const showCarousel = !imageUrl && (platform === "instagram" || slides.length > 1);
  const name = PLATFORM_PLAYBOOKS[platform]?.displayName ?? platform;

  return (
    <div className="l-creative">
      {imageUrl && spec ? (
        <figure className="l-creative-fig">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${name} image`} style={{ aspectRatio: `${spec.width} / ${spec.height}` }} />
          <figcaption>
            Cropped {spec.ratio} · {spec.width}×{spec.height}
            <a href={imageUrl} download className="l-link">
              Download
            </a>
          </figcaption>
        </figure>
      ) : (
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
            Carousel · {slides.length} slides
          </p>
          <div className="l-carousel">
            {slides.map((_, index) => {
              const url = `/api/og/carousel?draftId=${encodeURIComponent(draftId)}&slide=${index}`;
              return (
                <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Open slide ${index + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" />
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
