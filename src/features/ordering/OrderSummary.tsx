import { Card } from "../../components/ui/Card";
import { formatTHB } from "../../utils/money";
import type { Translation } from "../../i18n";
import type { ProductSettings } from "../../types/firestore";
import type { QuantityState } from "./stockUtils";
import { calculateOrderSummary } from "./stockUtils";

interface OrderSummaryProps {
  quantities: QuantityState;
  productSettings: ProductSettings;
  t: Translation;
  paymentLabel: string;
}

export function OrderSummary({
  quantities,
  productSettings,
  t,
  paymentLabel,
}: OrderSummaryProps): JSX.Element {
  const summary = calculateOrderSummary(quantities, productSettings);

  return (
    <Card title={t.orderSummary}>
      <div className="space-y-1 text-sm">
        <p>
          {t.regularHoi} x {quantities.regular} = {formatTHB(quantities.regular * productSettings.regular.price)} THB
        </p>
        <p>
          {t.smallHoi} x {quantities.small} = {formatTHB(quantities.small * productSettings.small.price)} THB
        </p>
        <p>
          {t.extraSauce} x {quantities.extraSauce} ={" "}
          {formatTHB(quantities.extraSauce * productSettings.extraSauce.price)} THB
        </p>
        <p>
          {t.hoiOpener} x {quantities.opener} = {formatTHB(quantities.opener * productSettings.opener.price)} THB
        </p>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p>
          {t.includedSauce}: {summary.includedSauce}
        </p>
        <p>
          {t.extraSauce}: {summary.extraSauce}
        </p>
        <p>
          {t.totalSauce}: {summary.totalSauce}
        </p>
      </div>
      <p className="mt-3 text-base font-bold">
        {t.total}: {formatTHB(summary.total)} THB
      </p>
      <p className="text-sm text-slate-700">
        {t.paymentMethod}: {paymentLabel}
      </p>
    </Card>
  );
}
