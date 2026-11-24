import type { ReactNode } from "react";

/** Big condensed page title with an optional count, lede, and actions. */
export function PageHeader({
  title,
  count,
  description,
  actions,
}: {
  title: string;
  count?: number | string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="l-page-header">
      <div className="l-page-header-text">
        <h1 className="l-h1">
          {title}
          {count !== undefined ? <span className="l-faint"> {count}</span> : null}
        </h1>
        {description ? <p className="l-lede">{description}</p> : null}
      </div>
      {actions ? <div className="l-page-header-actions">{actions}</div> : null}
    </div>
  );
}
