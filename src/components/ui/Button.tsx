import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

interface ButtonProps
  extends PropsWithChildren,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: "primary" | "secondary" | "danger";
  size?: "default" | "compact";
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "default",
  fullWidth = false,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      {...props}
      className={clsx(
        "min-h-11 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "compact" ? "px-3 py-2 text-xs sm:text-sm" : "px-4 py-2 text-sm",
        fullWidth ? "w-full" : "",
        variant === "primary" && "bg-brand-red text-white shadow-sm hover:bg-brand-redDark",
        variant === "secondary" &&
          "border border-brand-gold/40 bg-brand-cream text-brand-redDark hover:bg-amber-100",
        variant === "danger" && "bg-red-800 text-white hover:bg-red-900",
      )}
    >
      {children}
    </button>
  );
}
