import { Card } from "../../components/ui/Card";
import { formatTHB } from "../../utils/money";
import type { Language, Translation } from "../../i18n";
import type { OrderQuantities, ProductDoc } from "../../types/firestore";
import { SPECIAL_EXTRA_PRICE_THB } from "./regularSpecial";

interface OrderSummaryProps {
  language: Language;
  quantities: OrderQuantities;
  specialRegularCount?: number;
  products: ProductDoc[];
  t: Translation;
  paymentLabel: string;
}

interface SummaryLine {
  key: string;
  label: string;
  quantity: number;
  lineTotal: number;
}

function buildSummaryLines(
  products: ProductDoc[],
  quantities: OrderQuantities,
  specialRegularCount: number,
  language: Language,
): SummaryLine[] {
  const lines: SummaryLine[] = [];

  products.forEach((product) => {
    const quantity = quantities[product.id] ?? 0;
    if (quantity <= 0) {
      return;
    }

    const baseLabel = language === "th" ? product.thaiLabel : product.label;

    if (product.id === "regular") {
      const specialQty = Math.min(specialRegularCount, quantity);
      const standardQty = quantity - specialQty;

      if (standardQty > 0) {
        lines.push({
          key: "regular-standard",
          label: baseLabel,
          quantity: standardQty,
          lineTotal: standardQty * product.price,
        });
      }

      if (specialQty > 0) {
        lines.push({
          key: "regular-special",
          label:
            language === "th"
              ? `${baseLabel} (พิเศษ +500 กรัม)`
              : `${baseLabel} (special +500g)`,
          quantity: specialQty,
          lineTotal: specialQty * (product.price + SPECIAL_EXTRA_PRICE_THB),
        });
      }
      return;
    }

    lines.push({
      key: product.id,
      label: baseLabel,
      quantity,
      lineTotal: quantity * product.price,
    });
  });

  return lines;
}

export function OrderSummary({
  language,
  quantities,
  specialRegularCount = 0,
  products,
  t,
  paymentLabel,
}: OrderSummaryProps): JSX.Element {
  const summaryLines = buildSummaryLines(products, quantities, specialRegularCount, language);
  const total = summaryLines.reduce((sum, line) => sum + line.lineTotal, 0);

  return (
    <Card title={t.orderSummary}>
      <ul className="space-y-2 text-sm leading-snug">
        {summaryLines.map((line) => (
          <li key={line.key} className="flex items-start gap-2">
            <span className="w-5 shrink-0 text-right font-medium tabular-nums text-slate-700">
              {line.quantity}
            </span>
            <span className="min-w-0 flex-1 font-medium text-brand-redDark">{line.label}</span>
            <span className="shrink-0 pl-1 text-right font-semibold tabular-nums text-brand-redDark">
              {formatTHB(line.lineTotal)} THB
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg bg-brand-red p-3 text-white">
        <p className="text-base font-bold">
          {t.total}: {formatTHB(total)} THB
        </p>
        <p className="text-sm text-white/90">
          {t.paymentMethod}: {paymentLabel}
        </p>
      </div>
    </Card>
  );
}
