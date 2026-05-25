import type { PropsWithChildren } from "react";
import clsx from "clsx";

interface AlertProps extends PropsWithChildren {
  tone?: "info" | "warning" | "error";
}

export function Alert({ tone = "info", children }: AlertProps): JSX.Element {
  return (
    <div
      className={clsx(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-800",
        tone === "warning" && "border-brand-gold/40 bg-brand-cream text-brand-redDark",
        tone === "error" && "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {children}
    </div>
  );
}
