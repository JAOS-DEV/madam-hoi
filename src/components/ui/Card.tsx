import { useEffect, useState, type PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
  collapsible?: boolean;
  collapseStorageKey?: string;
  defaultCollapsed?: boolean;
}

export function Card({
  title,
  children,
  collapsible = false,
  collapseStorageKey,
  defaultCollapsed = false,
}: CardProps): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (!collapsible || !collapseStorageKey) {
      return;
    }
    try {
      const saved = window.localStorage.getItem(collapseStorageKey);
      if (saved === "true" || saved === "false") {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // Ignore storage access errors.
    }
  }, [collapsible, collapseStorageKey]);

  const toggleCollapsed = (): void => {
    if (!collapsible) {
      return;
    }
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    if (!collapseStorageKey) {
      return;
    }
    try {
      window.localStorage.setItem(collapseStorageKey, String(nextValue));
    } catch {
      // Ignore storage access errors.
    }
  };

  return (
    <section className="rounded-xl border border-brand-gold/30 bg-white/95 p-3 sm:p-4 shadow-[0_8px_22px_-16px_rgba(127,29,29,0.6)] backdrop-blur-sm">
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-brand-redDark sm:text-lg">{title}</h2>
          {collapsible ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="flex min-h-9 min-w-9 items-center justify-center rounded-full border border-brand-gold/40 bg-brand-cream/70 text-brand-redDark transition hover:bg-amber-100"
              aria-expanded={!isCollapsed}
              aria-label="Toggle section"
            >
              <span
                className={`inline-block text-sm leading-none transition-transform ${
                  isCollapsed ? "rotate-180" : ""
                }`}
              >
                ˅
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
      {isCollapsed ? null : children}
    </section>
  );
}
