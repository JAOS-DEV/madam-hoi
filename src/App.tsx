import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { auth } from "./lib/firebase";
import { translations, type Language } from "./i18n";
import type { MainSettingsDoc, ProductDoc, StockDoc } from "./types/firestore";
import { subscribeProducts, subscribeSettings, subscribeStock } from "./features/ordering/orderService";
import { OrderPage } from "./features/ordering/OrderPage";
import { ConfirmationPage } from "./features/ordering/ConfirmationPage";
import { AdminLogin } from "./features/admin/AdminLogin";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { isAllowedAdmin } from "./features/admin/adminService";

const LANGUAGE_STORAGE_KEY = "madam-hoi.language";

function getInitialLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "th" || stored === "en") {
      return stored;
    }
  } catch {
    // Ignore localStorage access errors and use default language.
  }
  return "th";
}

function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [settings, setSettings] = useState<MainSettingsDoc | null>(null);
  const [stock, setStock] = useState<StockDoc | null>(null);
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [stockReady, setStockReady] = useState(false);
  const [productsReady, setProductsReady] = useState(false);

  useEffect(() => {
    const unsubSettings = subscribeSettings(
      (value) => {
        setSettings(value);
        setSettingsReady(true);
      },
      () => {
        setSettings(null);
        setSettingsReady(true);
      },
    );
    const unsubStock = subscribeStock(
      (value) => {
        setStock(value);
        setStockReady(true);
      },
      () => {
        setStock(null);
        setStockReady(true);
      },
    );
    const unsubProducts = subscribeProducts(
      (value) => {
        setProducts(value);
        setProductsReady(true);
      },
      () => {
        setProducts([]);
        setProductsReady(true);
      },
    );
    const unsubAuth = onAuthStateChanged(auth, setUser);
    return () => {
      unsubSettings();
      unsubStock();
      unsubProducts();
      unsubAuth();
    };
  }, []);

  const toggleLanguage = (): void => {
    setLanguage((prev) => (prev === "th" ? "en" : "th"));
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore localStorage access errors.
    }
  }, [language]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route
          path="/"
          element={
            <OrderPage
              language={language}
              onToggleLanguage={toggleLanguage}
              settings={settings}
              stock={stock}
              products={products}
              isInitialLoading={!settingsReady || !stockReady || !productsReady}
            />
          }
        />
        <Route
          path="/confirmation/:orderId"
          element={<ConfirmationPage language={language} settings={settings} />}
        />
        <Route
          path="/admin"
          element={
            isAllowedAdmin(user) && settings && stock ? (
              <AdminDashboard
                language={language}
                onToggleLanguage={toggleLanguage}
                settings={settings}
                stock={stock}
                products={products}
              />
            ) : (
              <AdminLogin t={translations[language]} onToggleLanguage={toggleLanguage} />
            )
          }
        />
        <Route
          path="/admin/products"
          element={<Navigate to="/admin?section=products_stock" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
