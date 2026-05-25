import { Button } from "../../components/ui/Button";

interface QuantityStepperProps {
  label: string;
  value: number;
  canIncrease: boolean;
  canDecrease: boolean;
  onIncrease: () => void;
  onDecrease: () => void;
  subtitle?: string;
}

export function QuantityStepper({
  label,
  value,
  canIncrease,
  canDecrease,
  onIncrease,
  onDecrease,
  subtitle,
}: QuantityStepperProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-gold/30 bg-gradient-to-r from-white to-amber-50/40 p-3">
      <div>
        <p className="font-medium text-brand-redDark">{label}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" disabled={!canDecrease} onClick={onDecrease}>
          -
        </Button>
        <span className="min-w-8 rounded-md border border-brand-gold/30 bg-white px-2 py-1 text-center font-semibold text-brand-redDark">
          {value}
        </span>
        <Button type="button" disabled={!canIncrease} onClick={onIncrease}>
          +
        </Button>
      </div>
    </div>
  );
}
