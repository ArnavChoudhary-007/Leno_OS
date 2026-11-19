"use client";

import { useMemo } from "react";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { splitInstagramBody } from "@/agents/platforms/instagram-rules";
import { splitCarouselSlides } from "@/creative/slides";
import type { PlatformId } from "@/shared/types";

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
  const instagram = useMemo(() => platform === "instagram" ? splitInstagramBody(body) : null, [platform, body]);
  const slides = useMemo(() => instagram?.slides.length ? instagram.slides : splitCarouselSlides(body), [instagram, body]);
  const explicitCarousel = Boolean(instagram?.slides.length);
  const showCarousel = explicitCarousel || (!instagram?.stories.length && !imageUrl && (platform === "instagram" || slides.length > 1));

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
      ) : explicitCarousel || instagram?.stories.length ? null : (
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
      )}

      {showCarousel ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {explicitCarousel ? "Instagram carousel" : "Carousel"} ({slides.length} slides)
            {explicitCarousel ? " - 1080 x 1350 JPEG" : ""}
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
                    className={`${explicitCarousel ? "aspect-[4/5]" : "aspect-square"} w-28 rounded-md border border-border bg-muted object-cover`}
                  />
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
      {instagram?.stories.length ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Instagram story script ({instagram.stories.length} frames)</p>
          <p className="mb-2 text-xs text-muted-foreground">Copy script exports the full script. Add interactive stickers in Instagram; they are instructions, not live controls.</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {instagram.stories.map((story, index) => <li key={index}>{story}</li>)}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
