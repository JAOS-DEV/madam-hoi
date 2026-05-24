import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, StockDoc } from "../../types/firestore";
import { logoutAdmin } from "./adminService";
import { subscribeOrders } from "../ordering/orderService";
import { BankDetailsPanel } from "./BankDetailsPanel";
import { DailySummary } from "./DailySummary";
import { OrdersPanel } from "./OrdersPanel";
import { ProductSettingsPanel } from "./ProductSettingsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { StockPanel } from "./StockPanel";

interface AdminDashboardProps {
  language: Language;
  settings: MainSettingsDoc;
  stock: StockDoc;
}

export function AdminDashboard({
  language,
  settings,
  stock,
}: AdminDashboardProps): JSX.Element {
  const t = useMemo(() => translations[language], [language]);
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);

  useEffect(() => {
    const unsubOrders = subscribeOrders(setOrders);
    return () => {
      unsubOrders();
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-brand-red">{t.adminTitle}</h1>
          <p className="text-sm text-slate-600">{t.adminSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="secondary">{t.backToOrdering}</Button>
          </Link>
          <Button variant="secondary" onClick={() => void logoutAdmin()}>
            {t.signOut}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel settings={settings} t={t} />
        <StockPanel stock={stock} t={t} />
        <ProductSettingsPanel settings={settings} t={t} />
        <BankDetailsPanel settings={settings} t={t} />
      </div>

      <DailySummary orders={orders} stock={stock} t={t} />
      <OrdersPanel orders={orders} t={t} />
    </main>
  );
}
