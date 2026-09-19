import type { CritiqueScores, PlatformId } from "@/shared/types";
import { platformLabel } from "@/lib/workspace-ui";

export type FeedAuthor = {
  name: string;
  handle: string;
  initial: string;
  role?: string;
};

export function FeedPreview({
  platform,
  body,
  hashtags,
  imageUrl,
  author,
}: {
  platform: string;
  body: string;
  hashtags: string[];
  imageUrl?: string | null;
  author: FeedAuthor;
}) {
  const tags = hashtags.join(" ");
  if (platform === "instagram") {
    return (
      <div className="instagram-preview-card">
        <div className="instagram-header">
          <div className="instagram-avatar">
            <div className="instagram-avatar-inner">{author.initial}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600 }}>{author.handle}</div>
            <div style={{ fontSize: "0.7rem", color: "#888" }}>{author.role ?? "Brand"}</div>
          </div>
        </div>
        <div className="instagram-image-box">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" />
          ) : (
            <span style={{ color: "#888", fontSize: "0.82rem" }}>Carousel / quote card</span>
          )}
        </div>
        <div className="instagram-caption-box">
          <strong>{author.handle}</strong> {body.slice(0, 220)}
          {body.length > 220 ? "…" : ""}
          {tags ? (
            <div style={{ marginTop: 6, color: "#00376b", fontSize: "0.78rem" }}>{tags}</div>
          ) : null}
        </div>
      </div>
    );
  }

  if (platform === "x" || platform === "threads") {
    return (
      <div className="twitter-preview-card">
        <div className="twitter-header">
          <div className="twitter-avatar">{author.initial}</div>
          <div className="twitter-names">
            <span className="twitter-name">{author.name}</span>
            <span className="twitter-handle">@{author.handle}</span>
            <span style={{ color: "#536471", fontSize: "0.8rem" }}>· Just now</span>
          </div>
        </div>
        <div className="twitter-body">{body.slice(0, 280)}</div>
      </div>
    );
  }

  return (
    <div className="linkedin-preview-card">
      <div className="linkedin-header">
        <div className="linkedin-author-avatar">{author.initial}</div>
        <div className="linkedin-author-details">
          <span className="linkedin-author-name">{author.name}</span>
          <span className="linkedin-author-title">
            {author.role ?? platformLabel(platform as PlatformId)}
          </span>
          <span style={{ fontSize: "0.7rem", color: "#888" }}>Just now · Public</span>
        </div>
      </div>
      <div className="linkedin-body-text">{body}</div>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="linkedin-asset-preview" />
      ) : null}
      <div className="linkedin-reactions-bar">
        <span>Like · Comment · Repost</span>
        <span>{platformLabel(platform as PlatformId)}</span>
      </div>
    </div>
  );
}

export function QualityScorecard({ scores }: { scores: CritiqueScores | null }) {
  const hook = scores ? Math.round(scores.craft * 10) : null;
  const read = scores ? Math.round(scores.brand_voice * 10) : null;
  const fit = scores ? Math.round(scores.platform_fit * 10) : null;
  const virality =
    scores && (scores.goal_fit + scores.craft) / 2 >= 0.8
      ? "High"
      : scores && (scores.goal_fit + scores.craft) / 2 >= 0.55
        ? "Medium"
        : scores
          ? "Low"
          : "—";

  return (
    <div className="ai-quality-panel">
      <div className="quality-score-item">
        <span className="quality-score-val">{hook != null ? `${hook}/10` : "—"}</span>
        <span className="quality-score-lbl">Hook Score</span>
      </div>
      <div className="quality-score-item">
        <span className="quality-score-val">{read != null ? `${read}/10` : "—"}</span>
        <span className="quality-score-lbl">Brand voice</span>
      </div>
      <div className="quality-score-item">
        <span className="quality-score-val">{fit != null ? `${fit}/10` : "—"}</span>
        <span className="quality-score-lbl">Platform Fit</span>
      </div>
      <div className="quality-score-item">
        <span className="quality-score-val" style={{ color: "var(--accent-primary)" }}>
          {virality}
        </span>
        <span className="quality-score-lbl">Goal fit</span>
      </div>
    </div>
  );
}
