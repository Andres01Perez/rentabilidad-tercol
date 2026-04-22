import * as React from "react";
import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon: Icon, eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="flex-1">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </span>
        </div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-elegant">
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}