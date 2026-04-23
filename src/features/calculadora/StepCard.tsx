import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepCardProps {
  step: number;
  title: string;
  description?: string;
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export function StepCard({ step, title, description, done, disabled, children }: StepCardProps) {
  return (
    <div
      className={cn(
        "glass relative flex h-full flex-col rounded-2xl border border-border/60 p-5 transition-all",
        disabled && "opacity-50 saturate-50",
        done && "ring-1 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm",
            done
              ? "bg-gradient-brand text-white"
              : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      <div className={cn("mt-4 flex-1", disabled && "pointer-events-none")}>{children}</div>
    </div>
  );
}