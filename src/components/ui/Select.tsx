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
      <select
        {...props}
        ref={ref}
        className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-base text-slate-900 outline-none ring-brand-red transition focus:border-brand-gold focus:ring-2 sm:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
});
