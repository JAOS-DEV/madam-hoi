import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
}

export function Card({ title, children }: CardProps): JSX.Element {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {title ? <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2> : null}
      {children}
    </section>
  );
}
