import { useState } from "react";
import type { ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type { CustomerProfileDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { OrderForm } from "../ordering/OrderForm";

interface AdminOrderEntrySectionProps {
  language: Language;
  t: Translation;
  orderingOpen: boolean;
  stock: StockDoc;
  products: ProductDoc[];
  customers: CustomerProfileDoc[];
  onToast: (message: string, tone: ToastTone) => void;
}

export function AdminOrderEntrySection({
  language,
  t,
  orderingOpen,
  stock,
  products,
  customers,
  onToast,
}: AdminOrderEntrySectionProps): JSX.Element {
  const [formResetKey, setFormResetKey] = useState(0);

  return (
    <section className="space-y-2 rounded-xl border border-brand-gold/30 bg-white/95 p-3 sm:p-4 shadow-[0_8px_22px_-16px_rgba(127,29,29,0.6)]">
      <h2 className="text-base font-semibold text-brand-redDark sm:text-lg">
        {language === "th" ? "เพิ่มออเดอร์ด้วยแอดมิน" : "Manual order entry"}
      </h2>
      <p className="text-xs text-slate-600">
        {language === "th"
          ? "ใช้ฟอร์มเดียวกับลูกค้า แล้วเลือกแหล่งที่มาออเดอร์ได้"
          : "Uses the same order form; choose order source for tracking."}
      </p>
      <OrderForm
        key={formResetKey}
        language={language}
        mode="admin"
        orderingOpen={orderingOpen}
        stock={stock}
        products={products}
        customers={customers}
        t={t}
        onToast={onToast}
        onOrderSuccess={(_orderId, orderRef) => {
          onToast(`${t.orderReceived} (${orderRef})`, "success");
          setFormResetKey((prev) => prev + 1);
        }}
      />
    </section>
  );
}
