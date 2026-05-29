import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ToastHost } from "../../components/ui/ToastHost";
import { useToast } from "../../hooks/useToast";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { logoutAdmin } from "./adminService";
import { subscribeOrders } from "../ordering/orderService";
import { BankDetailsPanel } from "./BankDetailsPanel";
import { DailySummary } from "./DailySummary";
import { OrdersPanel } from "./OrdersPanel";
import { ProductSettingsPanel } from "./ProductSettingsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { StockPanel } from "./StockPanel";
import { AdminProductsPage } from "./AdminProductsPage";

interface AdminDashboardProps {
  language: Language;
  onToggleLanguage: () => void;
  settings: MainSettingsDoc;
  stock: StockDoc;
  products: ProductDoc[];
}

type DashboardSection = "settings" | "products_stock" | "orders_reports";

function toDashboardSection(value: string | null): DashboardSection {
  if (value === "products_stock" || value === "orders_reports") {
    return value;
  }
  return "settings";
}

export function AdminDashboard({
  language,
  onToggleLanguage,
  settings,
  stock,
  products,
}: AdminDashboardProps): JSX.Element {
  const assetBase = import.meta.env.BASE_URL;
  const t = useMemo(() => translations[language], [language]);
  const { toast, showToast } = useToast();
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [activeSection, setActiveSection] = useState<DashboardSection>(
    toDashboardSection(sectionParam),
  );

  useEffect(() => {
    const unsubOrders = subscribeOrders(setOrders);
    return () => {
      unsubOrders();
    };
  }, []);

  const handleToggleMenu = (): void => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleSignOut = async (): Promise<void> => {
    await logoutAdmin();
  };

  const handleSelectSection = (section: DashboardSection): void => {
    setActiveSection(section);
    setIsMenuOpen(false);
    setSearchParams({ section }, { replace: true });
  };

  useEffect(() => {
    setActiveSection(toDashboardSection(sectionParam));
  }, [sectionParam]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <ToastHost toast={toast} />
      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label={isMenuOpen ? t.adminMenuClose : t.adminMenuLabel}
            onClick={handleToggleMenu}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-brand-gold/40 bg-brand-cream text-brand-redDark transition hover:bg-amber-100"
          >
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 rounded bg-current" />
              <span className="block h-0.5 w-5 rounded bg-current" />
              <span className="block h-0.5 w-5 rounded bg-current" />
            </span>
          </button>
          <Button size="compact" variant="secondary" onClick={onToggleLanguage}>
            {t.languageToggle}
          </Button>
        </div>
        <header className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-blush via-brand-cream to-amber-100 p-3 sm:p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
          <div className="space-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <img
                src={`${assetBase}branding/logo.png`}
                alt="Madam Hoi logo"
                className="h-9 w-9 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
              <h1 className="text-lg font-bold text-brand-red sm:text-xl">{t.adminTitle}</h1>
                <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-600">
                  {t.adminSubtitle}
                </p>
              </div>
            </div>
          </div>
        </header>
        {isMenuOpen ? (
          <div className="absolute left-0 right-0 top-[3.7rem] z-20 space-y-2 rounded-xl border border-brand-gold/40 bg-white p-3 shadow-xl sm:left-0 sm:right-auto sm:w-80">
            <Link to="/" className="block">
              <Button size="compact" fullWidth variant="secondary" onClick={handleToggleMenu}>
                {t.backToOrdering}
              </Button>
            </Link>
            <Button
              size="compact"
              fullWidth
              variant={activeSection === "settings" ? "primary" : "secondary"}
              onClick={() => handleSelectSection("settings")}
            >
              {t.adminTabSettings}
            </Button>
            <Button
              size="compact"
              fullWidth
              variant={activeSection === "products_stock" ? "primary" : "secondary"}
              onClick={() => handleSelectSection("products_stock")}
            >
              {t.adminTabProductsStock}
            </Button>
            <Button
              size="compact"
              fullWidth
              variant={activeSection === "orders_reports" ? "primary" : "secondary"}
              onClick={() => handleSelectSection("orders_reports")}
            >
              {t.adminOrdersReports}
            </Button>
            <Button size="compact" fullWidth variant="secondary" onClick={() => void handleSignOut()}>
              {t.signOut}
            </Button>
          </div>
        ) : null}
      </div>

      {activeSection === "settings" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SettingsPanel settings={settings} t={t} onToast={showToast} />
          <BankDetailsPanel settings={settings} t={t} onToast={showToast} />
        </div>
      ) : null}

      {activeSection === "products_stock" ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <StockPanel stock={stock} t={t} onToast={showToast} />
            <ProductSettingsPanel settings={settings} t={t} onToast={showToast} />
          </div>
          <AdminProductsPage
            language={language}
            products={products}
            onToggleLanguage={onToggleLanguage}
            showHeader={false}
            onToast={showToast}
          />
        </div>
      ) : null}

      {activeSection === "orders_reports" ? (
        <div className="space-y-4">
          <DailySummary orders={orders} stock={stock} t={t} />
          <OrdersPanel orders={orders} t={t} settings={settings} onToast={showToast} />
        </div>
      ) : null}
    </main>
  );
}
