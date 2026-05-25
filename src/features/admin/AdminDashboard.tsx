import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { logoutAdmin } from "./adminService";
import { subscribeOrders } from "../ordering/orderService";
import { BankDetailsPanel } from "./BankDetailsPanel";
import { DailySummary } from "./DailySummary";
import { OrdersPanel } from "./OrdersPanel";
import { SettingsPanel } from "./SettingsPanel";
import { StockPanel } from "./StockPanel";

interface AdminDashboardProps {
  language: Language;
  onToggleLanguage: () => void;
  settings: MainSettingsDoc;
  stock: StockDoc;
  products: ProductDoc[];
}

export function AdminDashboard({
  language,
  onToggleLanguage,
  settings,
  stock,
  products,
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
      <header className="flex items-center justify-between rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-blush via-brand-cream to-amber-100 p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
        <div>
          <h1 className="text-xl font-bold text-brand-red">{t.adminTitle}</h1>
          <p className="text-sm text-slate-600">{t.adminSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onToggleLanguage}>
            {t.languageToggle}
          </Button>
          <Link to="/">
            <Button variant="secondary">{t.backToOrdering}</Button>
          </Link>
          <Link to="/admin/products">
            <Button variant="secondary">
              {language === "th" ? `สินค้า (${products.length})` : `Products (${products.length})`}
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => void logoutAdmin()}>
            {t.signOut}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel settings={settings} t={t} />
        <StockPanel stock={stock} t={t} />
        <BankDetailsPanel settings={settings} t={t} />
        <Card title={language === "th" ? "จัดการสินค้า" : "Manage products"}>
          <p className="text-sm text-slate-600">
            {language === "th"
              ? "เพิ่ม ลบ และแก้ไขสินค้าในหน้า Products"
              : "Add, remove, and edit products in the Products page."}
          </p>
          <div className="mt-3">
            <Link to="/admin/products">
              <Button>{language === "th" ? "ไปที่หน้า Products" : "Go to Products page"}</Button>
            </Link>
          </div>
        </Card>
      </div>

      <DailySummary orders={orders} stock={stock} t={t} />
      <OrdersPanel orders={orders} t={t} settings={settings} />
    </main>
  );
}
