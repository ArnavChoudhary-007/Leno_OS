import { ImageResponse } from "next/og";

// TODO: implement — render a branded OG image per campaign/draft once the
// campaign detail page exists.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 48,
          background: "#0a0a0a",
          color: "#fff",
        }}
      >
        Digital Distribution OS
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
