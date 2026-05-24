import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { auth } from "./lib/firebase";
import { translations, type Language } from "./i18n";
import type { MainSettingsDoc, StockDoc } from "./types/firestore";
import { subscribeSettings, subscribeStock } from "./features/ordering/orderService";
import { OrderPage } from "./features/ordering/OrderPage";
import { ConfirmationPage } from "./features/ordering/ConfirmationPage";
import { AdminLogin } from "./features/admin/AdminLogin";
import { AdminDashboard } from "./features/admin/AdminDashboard";
import { isAllowedAdmin } from "./features/admin/adminService";

function App(): JSX.Element {
  const [language, setLanguage] = useState<Language>("th");
  const [settings, setSettings] = useState<MainSettingsDoc | null>(null);
  const [stock, setStock] = useState<StockDoc | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [stockReady, setStockReady] = useState(false);

  useEffect(() => {
    const unsubSettings = subscribeSettings((value) => {
      setSettings(value);
      setSettingsReady(true);
    });
    const unsubStock = subscribeStock((value) => {
      setStock(value);
      setStockReady(true);
    });
    const unsubAuth = onAuthStateChanged(auth, setUser);
    return () => {
      unsubSettings();
      unsubStock();
      unsubAuth();
    };
  }, []);

  const toggleLanguage = (): void => {
    setLanguage((prev) => (prev === "th" ? "en" : "th"));
  };

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
              isInitialLoading={!settingsReady || !stockReady}
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
              <AdminDashboard language={language} settings={settings} stock={stock} />
            ) : (
              <AdminLogin t={translations[language]} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
