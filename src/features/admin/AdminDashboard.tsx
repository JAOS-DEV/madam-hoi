import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ToastHost } from "../../components/ui/ToastHost";
import { useToast } from "../../hooks/useToast";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import { publicOrderingEnabled } from "../../lib/firebase";
import type { CustomerProfileDoc, MainSettingsDoc, OrderDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { logoutAdmin } from "./adminService";
import { subscribeCustomers, subscribeOrders } from "../ordering/orderService";
import { BankDetailsPanel } from "./BankDetailsPanel";
import { OrdersPanel } from "./OrdersPanel";
import { SettingsPanel } from "./SettingsPanel";
import { StockPanel } from "./StockPanel";
import { AdminProductsPage } from "./AdminProductsPage";
import { AdminOrderEntrySection } from "./AdminOrderEntrySection";
import { ShoppingPrepPanel } from "./ShoppingPrepPanel";
import { TodayPanel } from "./TodayPanel";
import { CustomersPanel } from "./CustomersPanel";

interface AdminDashboardProps {
  language: Language;
  onToggleLanguage: () => void;
  settings: MainSettingsDoc;
  stock: StockDoc;
  products: ProductDoc[];
}

type DashboardSection = "today" | "orders" | "stock" | "setup";

function toDashboardSection(value: string | null): DashboardSection {
  if (value === "orders" || value === "stock" || value === "setup" || value === "today") {
    return value;
  }
  if (value === "orders_reports") {
    return "orders";
  }
  if (value === "products_stock") {
    return "stock";
  }
  if (value === "settings") {
    return "setup";
  }
  return "today";
}

function getNavItems(language: Language): Array<{ section: DashboardSection; label: string }> {
  if (language === "th") {
    return [
      { section: "today", label: "วันนี้" },
      { section: "orders", label: "ออเดอร์" },
      { section: "stock", label: "สต็อก" },
      { section: "setup", label: "ตั้งค่า" },
    ];
  }
  return [
    { section: "today", label: "Today" },
    { section: "orders", label: "Orders" },
    { section: "stock", label: "Stock" },
    { section: "setup", label: "Setup" },
  ];
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
  const navItems = useMemo(() => getNavItems(language), [language]);
  const { toast, showToast } = useToast();
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [customers, setCustomers] = useState<CustomerProfileDoc[]>([]);
  const [setupScrollTarget, setSetupScrollTarget] = useState<"prep" | null>(null);
  const prepToolsRef = useRef<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [activeSection, setActiveSection] = useState<DashboardSection>(
    toDashboardSection(sectionParam),
  );

  useEffect(() => {
    const unsubOrders = subscribeOrders(setOrders);
    const unsubCustomers = subscribeCustomers(
      setCustomers,
      (error) => {
        showToast(error.message, "error");
      },
    );
    return () => {
      unsubOrders();
      unsubCustomers();
    };
  }, [showToast]);

  const handleSignOut = async (): Promise<void> => {
    await logoutAdmin();
  };

  const handleSelectSection = (section: DashboardSection): void => {
    setSetupScrollTarget(null);
    setActiveSection(section);
    if (section === "today") {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ section }, { replace: true });
  };

  const handleOpenPrepTools = (): void => {
    setActiveSection("setup");
    setSetupScrollTarget("prep");
    setSearchParams({ section: "setup" }, { replace: true });
  };

  useEffect(() => {
    setActiveSection(toDashboardSection(sectionParam));
  }, [sectionParam]);

  useEffect(() => {
    if (activeSection !== "setup" || setupScrollTarget !== "prep") {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const prepToolsTop = prepToolsRef.current?.getBoundingClientRect().top;
      if (prepToolsTop === undefined) {
        return;
      }
      window.scrollTo({
        top: window.scrollY + prepToolsTop - 12,
        behavior: "smooth",
      });
      setSetupScrollTarget(null);
    }, 80);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSection, setupScrollTarget]);

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 pb-28 pt-4 md:pb-6">
      <ToastHost toast={toast} />
      <header className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-blush via-brand-cream to-amber-100 p-3 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={`${assetBase}branding/logo.png`}
              alt="Madam Hoi logo"
              className="h-10 w-10 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-brand-red sm:text-xl">{t.adminTitle}</h1>
              <p className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-600">
                {language === "th"
                  ? "จัดการงานวันนี้ ออเดอร์ สต็อก และการตั้งค่า"
                  : "Daily operations, orders, stock, and setup."}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {publicOrderingEnabled ? (
              <Link to="/order" className="block">
                <Button size="compact" variant="secondary">
                  {language === "th" ? "หน้าลูกค้า" : "Customer View"}
                </Button>
              </Link>
            ) : null}
            <Button size="compact" variant="secondary" onClick={onToggleLanguage}>
              {t.languageToggle}
            </Button>
            <Button size="compact" variant="secondary" onClick={() => void handleSignOut()}>
              {t.signOut}
            </Button>
          </div>
        </div>
        <div className={`mt-3 grid gap-2 md:hidden ${publicOrderingEnabled ? "grid-cols-3" : "grid-cols-2"}`}>
          {publicOrderingEnabled ? (
            <Link to="/order" className="block">
              <Button size="compact" fullWidth variant="secondary">
                {language === "th" ? "หน้าลูกค้า" : "Customer View"}
              </Button>
            </Link>
          ) : null}
          <Button size="compact" fullWidth variant="secondary" onClick={onToggleLanguage}>
            {t.languageToggle}
          </Button>
          <Button size="compact" fullWidth variant="secondary" onClick={() => void handleSignOut()}>
            {language === "th" ? "ออก" : "Sign out"}
          </Button>
        </div>
        <nav className="mt-4 hidden gap-2 md:grid md:grid-cols-4">
          {navItems.map((item) => (
            <Button
              key={item.section}
              size="compact"
              variant={activeSection === item.section ? "primary" : "secondary"}
              onClick={() => handleSelectSection(item.section)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </header>

      {activeSection === "today" ? (
        <TodayPanel
          language={language}
          settings={settings}
          stock={stock}
          products={products}
          orders={orders}
          t={t}
          onToast={showToast}
          onNavigate={handleSelectSection}
          onOpenPrepTools={handleOpenPrepTools}
        />
      ) : null}

      {activeSection === "orders" ? (
        <div className="space-y-4">
          <AdminOrderEntrySection
            language={language}
            t={t}
            orderingOpen={settings.orderingOpen}
            stock={stock}
            products={products}
            customers={customers}
            onToast={showToast}
          />
          <OrdersPanel orders={orders} t={t} language={language} settings={settings} onToast={showToast} />
        </div>
      ) : null}

      {activeSection === "stock" ? (
        <StockPanel stock={stock} products={products} language={language} t={t} onToast={showToast} />
      ) : null}

      {activeSection === "setup" ? (
        <div className="space-y-4">
          <AdminProductsPage
            language={language}
            products={products}
            onToggleLanguage={onToggleLanguage}
            showHeader={false}
            onToast={showToast}
          />
          <CustomersPanel customers={customers} language={language} onToast={showToast} />
          <SettingsPanel settings={settings} t={t} onToast={showToast} />
          <BankDetailsPanel settings={settings} t={t} onToast={showToast} />
          <div ref={prepToolsRef} className="scroll-mt-4">
            <ShoppingPrepPanel language={language} orders={orders} products={products} onToast={showToast} />
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-gold/30 bg-white/95 px-3 pb-3 pt-2 shadow-[0_-10px_30px_-22px_rgba(127,29,29,0.75)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {navItems.map((item) => (
            <button
              key={item.section}
              type="button"
              onClick={() => handleSelectSection(item.section)}
              className={`min-h-11 rounded-lg px-2 text-xs font-semibold ${
                activeSection === item.section
                  ? "bg-brand-red text-white"
                  : "border border-brand-gold/30 bg-brand-cream text-brand-redDark"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
