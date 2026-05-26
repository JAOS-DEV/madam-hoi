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
      <header className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-blush via-brand-cream to-amber-100 p-3 sm:p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
        <div className="space-y-3">
          <div>
            <h1 className="text-lg font-bold text-brand-red sm:text-xl">{t.adminTitle}</h1>
            <p className="text-sm text-slate-600">{t.adminSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button size="compact" variant="secondary" onClick={onToggleLanguage}>
              {t.languageToggle}
            </Button>
            <Link to="/" className="w-full sm:w-auto">
              <Button size="compact" fullWidth variant="secondary">
                {t.backToOrdering}
              </Button>
            </Link>
            <Link to="/admin/products" className="w-full sm:w-auto">
              <Button size="compact" fullWidth variant="secondary">
                {language === "th" ? `สินค้า (${products.length})` : `Products (${products.length})`}
              </Button>
            </Link>
            <Button size="compact" variant="secondary" onClick={() => void logoutAdmin()}>
              {t.signOut}
            </Button>
          </div>
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
