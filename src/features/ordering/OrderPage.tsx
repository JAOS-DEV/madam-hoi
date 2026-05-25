import { useNavigate } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import type { MainSettingsDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { gramsToKgLabel } from "./stockUtils";
import { OrderForm } from "./OrderForm";

interface OrderPageProps {
  language: Language;
  onToggleLanguage: () => void;
  settings: MainSettingsDoc | null;
  stock: StockDoc | null;
  products: ProductDoc[];
  isInitialLoading: boolean;
}

export function OrderPage({
  language,
  onToggleLanguage,
  settings,
  stock,
  products,
  isInitialLoading,
}: OrderPageProps): JSX.Element {
  const navigate = useNavigate();
  const t = translations[language];
  const assetBase = import.meta.env.BASE_URL;

  if (isInitialLoading) {
    return <p className="mx-auto max-w-2xl p-4">Loading...</p>;
  }

  if (!settings || !stock) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <Card title="Setup required">
          <p className="text-sm text-slate-700">
            Missing Firestore docs: <code>settings/main</code>, <code>stock/today</code>, and/or <code>products</code>.
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
      <header className="overflow-hidden rounded-xl border border-brand-gold/30 bg-gradient-to-br from-brand-blush via-brand-cream to-amber-100 p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={`${assetBase}branding/logo.png`}
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
      <div className="brand-shell-divider" aria-hidden="true">
        <img src={`${assetBase}branding/shell.png`} alt="" />
      </div>

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
      </Card>

      {!settings.orderingOpen ? <Alert tone="warning">{t.orderingClosed}</Alert> : null}
      <OrderForm
        language={language}
        stock={stock}
        products={products}
        t={t}
        onOrderSuccess={(orderId) => {
          navigate(`/confirmation/${orderId}`);
        }}
      />
    </main>
  );
}
