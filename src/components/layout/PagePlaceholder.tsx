import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagePlaceholderProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  previews?: { title: string; hint: string; variant?: "table" | "chart" | "form" | "list" }[];
  status?: string;
}

function PreviewMock({ variant = "list" }: { variant?: "table" | "chart" | "form" | "list" }) {
  if (variant === "chart") {
    return (
      <div className="flex h-32 items-end gap-2">
        {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-md bg-gradient-brand-soft"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    );
  }
  if (variant === "table") {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-gradient-brand" />
            <div className="h-3 flex-1 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-3 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (variant === "form") {
    return (
      <div className="space-y-3">
        <div className="h-9 rounded-lg bg-muted" />
        <div className="h-9 rounded-lg bg-muted" />
        <div className="h-9 w-2/3 rounded-lg bg-gradient-brand-soft" />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-brand-soft" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-3/4 rounded bg-muted" />
            <div className="h-2 w-1/2 rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PagePlaceholder({
  icon: Icon,
  eyebrow,
  title,
  description,
  previews = [],
  status = "En construcción",
}: PagePlaceholderProps) {
  return (
    <div className="relative min-h-full">
      {/* Decorative gradient orb */}
      <div className="pointer-events-none absolute -top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.22_295/0.10),transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10 lg:px-10 lg:py-14">
        {/* Hero */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {eyebrow}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/60 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-brand" />
                {status}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="glass flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-gradient-brand">
              <Icon className="h-9 w-9 text-white" />
            </div>
          </div>
        </div>

        {/* Preview cards */}
        {previews.length > 0 && (
          <div className={cn(
            "mt-12 grid gap-5",
            previews.length === 1 && "grid-cols-1",
            previews.length === 2 && "grid-cols-1 md:grid-cols-2",
            previews.length >= 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
          )}>
            {previews.map((p, i) => (
              <div key={i} className="glass rounded-2xl p-6">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{p.title}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Preview
                  </span>
                </div>
                <p className="mb-5 text-xs text-muted-foreground">{p.hint}</p>
                <PreviewMock variant={p.variant} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
