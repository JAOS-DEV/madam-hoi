import clsx from "clsx";

interface ToastProps {
  message: string;
  tone: "success" | "error";
}

export function Toast({ message, tone }: ToastProps): JSX.Element {
  return (
    <div
      className={clsx(
        "pointer-events-auto rounded-lg border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm",
        tone === "success" && "border-emerald-300 bg-emerald-50/95 text-emerald-800",
        tone === "error" && "border-red-300 bg-red-50/95 text-red-800",
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
