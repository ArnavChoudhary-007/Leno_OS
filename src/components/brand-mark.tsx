import Link from "next/link";

/** The tilted lime "L" tile. Decorative; the wordmark carries the name. */
export function BrandMark({ size = 28 }: { size?: number }) {
  const glyph = Math.round(size * 0.57);
  return (
    <span
      aria-hidden="true"
      className="l-brand-mark"
      style={{ width: size, height: size }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 16 16" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="square">
        <path d="M4 2v12h8" />
      </svg>
    </span>
  );
}

/** Mark + LENO wordmark, linking home. */
export function BrandLockup({ href = "/", onClick }: { href?: string; onClick?: () => void }) {
  return (
    <Link href={href} className="l-brand" onClick={onClick}>
      <BrandMark />
      <span className="l-brand-word">Leno</span>
    </Link>
  );
}
