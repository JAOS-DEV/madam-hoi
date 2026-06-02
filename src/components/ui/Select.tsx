import { forwardRef, type SelectHTMLAttributes } from "react";

interface Option {
  label: string;
  value: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label: string;
  options: Option[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, ...props },
  ref,
): JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-brand-redDark">{label}</span>
      <span className="relative block w-full">
        <select
          {...props}
          ref={ref}
          className="block w-full max-w-full appearance-none rounded-lg border border-amber-300 bg-white px-3 py-2 pr-10 text-base text-slate-900 outline-none transition focus:border-brand-red focus:ring-2 focus:ring-brand-gold/40 sm:text-sm"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-brand-redDark">
          ˅
        </span>
      </span>
    </label>
  );
});
