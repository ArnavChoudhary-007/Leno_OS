"use client";

import { useMemo } from "react";
import { PLATFORM_PLAYBOOKS, splitInstagramBody } from "@/agents/platforms";
import { INSTAGRAM_CAROUSEL_SPEC } from "@/agents/platforms/instagram-rules";
import { splitCarouselSlides } from "@/creative/slides";
import type { PlatformId } from "@/shared/types";

export function DraftCreative({
  draftId,
  campaignId,
  body,
  platform,
  imageUrl,
}: {
  draftId: string;
  campaignId: string;
  body: string;
  platform: PlatformId;
  imageUrl?: string | null;
}) {
  const spec = PLATFORM_PLAYBOOKS[platform]?.imageSpec;
  const quoteUrl = `/api/og/quote?draftId=${encodeURIComponent(draftId)}`;

  // Instagram carousels come from explicit "Slide N:" markers in the body.
  // Everything else keeps the heuristic split behind the OG route.
  const instagramSlides = useMemo(
    () => (platform === "instagram" ? splitInstagramBody(body).slides : []),
    [platform, body],
  );
  const slides = useMemo(() => splitCarouselSlides(body), [body]);
  const showOgCarousel =
    instagramSlides.length === 0 &&
    !imageUrl &&
    (platform === "instagram" || slides.length > 1);

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {imageUrl && spec ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Fitted {spec.ratio} · {spec.width}×{spec.height}
            </p>
            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-4"
            >
              Open JPEG
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`${PLATFORM_PLAYBOOKS[platform]?.displayName ?? platform} crop`}
            className="w-full max-w-xs rounded-xl border border-border bg-muted object-cover"
            style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
          />
        </div>
      ) : instagramSlides.length === 0 ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Quote card</p>
            <a
              href={quoteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-4"
            >
              Open PNG
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={quoteUrl}
            alt="Branded quote card"
            className="aspect-square w-full max-w-xs rounded-xl border border-border bg-muted object-cover"
          />
        </div>
      ) : null}

      {instagramSlides.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Carousel · {instagramSlides.length} slides ·{" "}
            {INSTAGRAM_CAROUSEL_SPEC.ratio} ({INSTAGRAM_CAROUSEL_SPEC.width}×
            {INSTAGRAM_CAROUSEL_SPEC.height})
          </p>
          <div
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
            aria-label="Instagram carousel slides"
          >
            {instagramSlides.map((text, index) => {
              const url = `/api/images/${encodeURIComponent(campaignId)}/instagram/slide-${index + 1}`;
              return (
                <figure
                  key={url}
                  className="w-40 shrink-0 snap-start"
                  title={text}
                >
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Slide ${index + 1} of ${instagramSlides.length}: ${text}`}
                      loading="lazy"
                      className="w-full rounded-lg border border-border bg-muted object-cover"
                      style={{
                        aspectRatio: `${INSTAGRAM_CAROUSEL_SPEC.width} / ${INSTAGRAM_CAROUSEL_SPEC.height}`,
                      }}
                    />
                  </a>
                  <figcaption className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                    {index + 1}. {text}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ) : null}

      {showOgCarousel ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Carousel ({slides.length} slides)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {slides.map((_, index) => {
              const url = `/api/og/carousel?draftId=${encodeURIComponent(draftId)}&slide=${index}`;
              return (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                  title={`Slide ${index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Carousel slide ${index + 1}`}
                    className="aspect-square w-28 rounded-md border border-border bg-muted object-cover"
                  />
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
