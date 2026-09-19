"use client";

import { useMemo } from "react";
import { splitCarouselSlides } from "@/creative/slides";
import type { PlatformId } from "@/shared/types";

export function DraftCreative({
  draftId,
  body,
  platform,
}: {
  draftId: string;
  body: string;
  platform: PlatformId;
}) {
  const quoteUrl = `/api/og/quote?draftId=${encodeURIComponent(draftId)}`;
  const slides = useMemo(() => splitCarouselSlides(body), [body]);
  const showCarousel = platform === "instagram" || slides.length > 1;

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
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
          className="aspect-square w-full max-w-xs rounded-md border border-border bg-muted object-cover"
        />
      </div>

      {showCarousel ? (
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
