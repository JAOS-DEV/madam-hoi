import { Card } from "../../components/ui/Card";
import { formatTHB } from "../../utils/money";
import type { Language, Translation } from "../../i18n";
import type { OrderQuantities, ProductDoc } from "../../types/firestore";

interface OrderSummaryProps {
  language: Language;
  quantities: OrderQuantities;
  specialRegularCount?: number;
  products: ProductDoc[];
  t: Translation;
  paymentLabel: string;
}
const SPECIAL_EXTRA_PRICE_THB = 100;

export function OrderSummary({
  language,
  quantities,
  specialRegularCount = 0,
  products,
  t,
  paymentLabel,
}: OrderSummaryProps): JSX.Element {
  const selectedProducts = products
    .map((product) => ({ product, quantity: quantities[product.id] ?? 0 }))
    .filter((entry) => entry.quantity > 0);
  const includedSauce = selectedProducts.reduce(
    (sum, entry) => sum + entry.quantity * entry.product.includedSauce,
    0,
  );
  const extraSauce = selectedProducts
    .filter((entry) => entry.product.category === "sauce" && entry.product.includedSauce === 0)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const baseTotal = selectedProducts.reduce((sum, entry) => sum + entry.quantity * entry.product.price, 0);
  const total = baseTotal + specialRegularCount * SPECIAL_EXTRA_PRICE_THB;

  return (
    <Card title={t.orderSummary}>
      <div className="space-y-1 rounded-lg bg-amber-50/60 p-3 text-sm">
        {selectedProducts.map((entry) => (
          <p key={entry.product.id}>
            {(language === "th" ? entry.product.thaiLabel : entry.product.label)} x {entry.quantity} ={" "}
            {formatTHB(entry.quantity * entry.product.price)} THB
          </p>
        ))}
        {specialRegularCount > 0 ? (
          <p>
            {language === "th"
              ? `พิเศษ x${specialRegularCount} (+500 กรัมหอย/ชุด) = +${specialRegularCount * SPECIAL_EXTRA_PRICE_THB} THB`
              : `Special x${specialRegularCount} (+500g hoi each) = +${specialRegularCount * SPECIAL_EXTRA_PRICE_THB} THB`}
          </p>
        ) : null}
      </div>
      <div className="mt-3 space-y-1 rounded-lg border border-brand-gold/30 bg-white p-3 text-sm">
        <p>
          {t.includedSauce}: {includedSauce}
        </p>
        <p>
          {t.extraSauce}: {extraSauce}
        </p>
        <p>
          {t.totalSauce}: {includedSauce + extraSauce}
        </p>
      </div>
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
