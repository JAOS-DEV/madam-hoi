import type { PropsWithChildren } from "react";
import clsx from "clsx";

interface BadgeProps extends PropsWithChildren {
  tone?: "neutral" | "success" | "danger";
}

export function Badge({ tone = "neutral", children }: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2 py-1 text-xs font-medium",
        tone === "neutral" && "bg-slate-100 text-slate-700",
        tone === "success" && "bg-emerald-100 text-emerald-700",
        tone === "danger" && "bg-red-100 text-red-700",
      )}
    >
      {children}
    </span>
  );
}
