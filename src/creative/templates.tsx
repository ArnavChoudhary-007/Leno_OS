import { contrastingInk } from "./colors";

export type BrandVisual = {
  name: string;
  primary: string;
  secondary: string;
};

export const FALLBACK_BRAND: BrandVisual = {
  name: "Brand",
  primary: "#1F6FEB",
  secondary: "#F5A623",
};

/** Square canvas used for quote cards and carousel slides (IG-friendly). */
export const OG_SIZE = { width: 1080, height: 1080 } as const;

export function truncateForCard(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Quote-card JSX for ImageResponse (Satori-compatible inline styles only). */
export function QuoteCardMarkup({
  brand,
  quote,
}: {
  brand: BrandVisual;
  quote: string;
}) {
  const ink = contrastingInk(brand.primary);
  const muted = ink === "#FFFFFF" ? "rgba(255,255,255,0.72)" : "rgba(10,10,10,0.65)";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: brand.primary,
        color: ink,
        padding: 72,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 96,
          height: 8,
          backgroundColor: brand.secondary,
          borderRadius: 4,
        }}
      />
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          fontSize: quote.length > 160 ? 42 : 52,
          lineHeight: 1.25,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {truncateForCard(quote)}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{brand.name}</div>
          <div style={{ fontSize: 22, color: muted }}>Quote card</div>
        </div>
        <div
          style={{
            display: "flex",
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: brand.secondary,
          }}
        />
      </div>
    </div>
  );
}

/** One carousel slide JSX for ImageResponse. */
export function CarouselSlideMarkup({
  brand,
  text,
  index,
  total,
}: {
  brand: BrandVisual;
  text: string;
  index: number;
  total: number;
}) {
  const ink = contrastingInk(brand.primary);
  const muted = ink === "#FFFFFF" ? "rgba(255,255,255,0.7)" : "rgba(10,10,10,0.6)";
  const isLast = index === total - 1;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: brand.primary,
        color: ink,
        padding: 72,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 48,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 600, color: muted }}>
          {brand.name}
        </div>
        <div style={{ fontSize: 22, color: muted }}>
          {`${index + 1} / ${total}`}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          fontSize: text.length > 140 ? 40 : 48,
          lineHeight: 1.3,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {truncateForCard(text, 260)}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 40,
        }}
      >
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              width: i === index ? 36 : 12,
              height: 12,
              borderRadius: 6,
              backgroundColor:
                i === index ? brand.secondary : "rgba(255,255,255,0.35)",
            }}
          />
        ))}
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            fontSize: 22,
            fontWeight: 600,
            color: brand.secondary,
            opacity: isLast ? 1 : 0,
          }}
        >
          Swipe for more →
        </div>
      </div>
    </div>
  );
}
