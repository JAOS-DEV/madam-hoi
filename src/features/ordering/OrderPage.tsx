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
        : language === "th"
          ? "ช่วงเวลาจัดส่งอาจเปลี่ยนตามเส้นทางและจำนวนออเดอร์"
          : "Delivery window may vary depending on route and demand.";

  const announcement =
    language === "th"
      ? settings.announcementTh ?? settings.announcement
      : settings.announcementEn ?? settings.announcement;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="overflow-hidden rounded-xl border border-brand-gold/30 bg-gradient-to-br from-brand-blush via-brand-cream to-amber-100 p-3 sm:p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={`${assetBase}branding/logo.png`}
              alt="Madam Hoi logo"
              className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm sm:h-24 sm:w-24"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight text-brand-red sm:text-3xl">{t.brandName}</h1>
              <p className="text-sm font-medium text-slate-700">{t.brandTagline}</p>
            </div>
          </div>
          <div className="w-full sm:w-auto">
            <Button size="compact" fullWidth variant="secondary" onClick={onToggleLanguage}>
              {t.languageToggle}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-700">{t.brandSubline}</p>
      </header>
      <div className="brand-shell-divider" aria-hidden="true">
        <img src={`${assetBase}branding/shell.png`} alt="" />
      </div>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-redDark/80">{t.announcement}</p>
        <p className="text-base font-semibold text-brand-redDark">{announcement}</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{t.deliveryWindowLabel}</p>
        <p className="text-sm text-slate-700">{deliveryMessage}</p>
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
        orderingOpen={settings.orderingOpen}
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
