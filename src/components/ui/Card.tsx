import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
}

export function Card({ title, children }: CardProps): JSX.Element {
  return (
    <section className="rounded-xl border border-brand-gold/30 bg-white/95 p-4 shadow-[0_8px_22px_-16px_rgba(127,29,29,0.6)] backdrop-blur-sm">
      {title ? <h2 className="mb-3 text-lg font-semibold text-brand-redDark">{title}</h2> : null}
      {children}
    </section>
  );
}
