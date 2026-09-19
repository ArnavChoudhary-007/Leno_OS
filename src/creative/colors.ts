/** Hex color helpers for branded OG cards. Pure — safe on client and server. */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Relative luminance (0–1) for WCAG-style contrast picks. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Ink color that stays readable on `background`. */
export function contrastingInk(background: string): "#FFFFFF" | "#0A0A0A" {
  return luminance(background) > 0.45 ? "#0A0A0A" : "#FFFFFF";
}

export function isHexColor(value: string): boolean {
  return parseHex(value) !== null;
}
