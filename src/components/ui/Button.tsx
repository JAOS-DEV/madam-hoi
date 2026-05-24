import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import clsx from "clsx";

interface ButtonProps
  extends PropsWithChildren,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: "primary" | "secondary" | "danger";
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      {...props}
      className={clsx(
        "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        fullWidth ? "w-full" : "",
        variant === "primary" && "bg-brand-red text-white hover:bg-red-800",
        variant === "secondary" && "bg-slate-100 text-slate-800 hover:bg-slate-200",
        variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
      )}
    >
      {children}
    </button>
  );
}
