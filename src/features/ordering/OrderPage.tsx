import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import type { MainSettingsDoc, StockDoc } from "../../types/firestore";
import { gramsToKgLabel, createEmptyQuantities, getMaxAddable } from "./stockUtils";
import { OrderForm } from "./OrderForm";

interface OrderPageProps {
  language: Language;
  onToggleLanguage: () => void;
  settings: MainSettingsDoc | null;
  stock: StockDoc | null;
  isInitialLoading: boolean;
}

export function OrderPage({
  language,
  onToggleLanguage,
  settings,
  stock,
  isInitialLoading,
}: OrderPageProps): JSX.Element {
  const navigate = useNavigate();
  const t = translations[language];

  const maxAddable = useMemo(() => {
    if (!settings || !stock) {
      return { regular: 0, small: 0 };
    }
    return getMaxAddable(
      stock.availableHoiGrams,
      createEmptyQuantities(),
      settings.productSettings,
    );
  }, [settings, stock]);

  if (isInitialLoading) {
    return <p className="mx-auto max-w-2xl p-4">Loading...</p>;
  }

  if (!settings || !stock) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Card title="Setup required">
          <p className="text-sm text-slate-700">
            Missing Firestore docs: <code>settings/main</code> and/or <code>stock/today</code>.
          </p>
          <p className="mt-2 text-sm text-slate-700">Run <code>npm run seed</code> then refresh.</p>
        </Card>
      </main>
    );
  }

  const deliveryMessage =
    settings.deliveryMessage.template === "estimated_range"
      ? `${t.deliveryEstimatePrefix}: ${settings.deliveryMessage.startTime ?? "-"}-${settings.deliveryMessage.endTime ?? "-"}`
      : settings.deliveryMessage.template === "starts_after"
        ? `${t.deliveryEstimatePrefix}: ${settings.deliveryMessage.startTime ?? "-"}+`
        : settings.deliveryMessage.template === "custom"
          ? language === "th"
            ? settings.deliveryMessage.customMessageTh
            : settings.deliveryMessage.customMessageEn
          : language === "th"
            ? "เวลาจัดส่งโดยประมาณจะกำหนดในแต่ละวัน และอาจเปลี่ยนแปลงตามเส้นทางและจำนวนออเดอร์"
            : "Estimated delivery time is set daily and may vary depending on route and demand.";

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="overflow-hidden rounded-xl bg-gradient-to-br from-red-50 via-amber-50 to-emerald-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/branding/logo.png"
              alt="Madam Hoi logo"
              className="h-20 w-20 rounded-xl object-cover shadow-sm sm:h-24 sm:w-24"
            />
            <div className="flex-1">
              <h1 className="text-3xl font-bold leading-tight text-brand-red">{t.brandName}</h1>
              <p className="text-sm font-medium text-slate-700">{t.brandTagline}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={onToggleLanguage}>
            {t.languageToggle}
          </Button>
        </div>
        <p className="mt-3 text-sm text-slate-700">{t.brandSubline}</p>
      </header>

      <Card>
        <p className="text-sm font-medium">{t.announcement}</p>
        <p>{settings.announcement}</p>
        <p className="mt-2 text-sm">{deliveryMessage}</p>
      </Card>

      <Card>
        <p>
          {t.todayStock}: <strong>{gramsToKgLabel(stock.availableHoiGrams)}kg</strong>
        </p>
        <p className="text-sm text-slate-600">{t.stockAutoUpdates}</p>
        <div className="mt-2 flex gap-2">
          <Badge>{t.regular}: {maxAddable.regular}</Badge>
          <Badge>{t.small}: {maxAddable.small}</Badge>
        </div>
      </Card>

      {!settings.orderingOpen ? <Alert tone="warning">{t.orderingClosed}</Alert> : null}
      <OrderForm
        settings={settings}
        stock={stock}
        t={t}
        onOrderSuccess={(orderId) => {
          navigate(`/confirmation/${orderId}`);
        }}
      />
    </main>
  );
}
