import type { PropsWithChildren } from "react";
import clsx from "clsx";

interface BadgeProps extends PropsWithChildren {
  tone?: "neutral" | "success" | "danger";
}

export function Badge({ tone = "neutral", children }: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "border-brand-gold/40 bg-brand-cream text-brand-redDark",
        tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        tone === "danger" && "border-red-300 bg-red-50 text-red-700",
      )}
    >
      {children}
    </span>
  );
}
