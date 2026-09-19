import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="section-micro-label" style={{ marginBottom: 6 }}>
            {eyebrow}
          </p>
        ) : null}
        <h1 className="create-cockpit-title">{title}</h1>
        {description ? (
          <p className="create-cockpit-subtitle">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
