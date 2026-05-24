import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { db } from "../../lib/firebase";
import type { Language } from "../../i18n";
import { translations } from "../../i18n";
import type { MainSettingsDoc, OrderDoc } from "../../types/firestore";
import { formatTHB } from "../../utils/money";
import { getDeliverySnapshotByLanguage } from "./orderService";

interface ConfirmationPageProps {
  language: Language;
  settings: MainSettingsDoc | null;
}

export function ConfirmationPage({ language, settings }: ConfirmationPageProps): JSX.Element {
  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const t = translations[language];

  useEffect(() => {
    const loadOrder = async (): Promise<void> => {
      if (!params.orderId) {
        setLoading(false);
        return;
      }
      const snapshot = await getDoc(doc(db, "orders", params.orderId));
      setOrder(snapshot.exists() ? (snapshot.data() as OrderDoc) : null);
      setLoading(false);
    };
    void loadOrder();
  }, [params.orderId]);

  if (loading) {
    return <p className="mx-auto max-w-2xl p-4">Loading...</p>;
  }
  if (!order) {
    return <p className="mx-auto max-w-2xl p-4">Order not found.</p>;
  }

  const paymentLabel = order.paymentMethod === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery;
  const deliveryText = getDeliverySnapshotByLanguage(order.deliveryMessageSnapshot, language);

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <Card title={t.orderReceived}>
        <p className="font-semibold">
          {t.orderReference}: {order.orderRef}
        </p>
        <p className="mt-1 text-sm">{t.contactForChanges}</p>
      </Card>
      <Card title={t.orderSummary}>
        <p>
          {t.name}: {order.customer.name}
        </p>
        <p>
          {t.deliveryLocation}: {order.customer.deliveryLocation}
        </p>
        <p>
          {t.paymentMethod}: {paymentLabel}
        </p>
        <p>
          {t.total}: {formatTHB(order.calculated.total)} THB
        </p>
        <p>
          {t.includedSauce}: {order.calculated.includedSauce}
        </p>
        <p>
          {t.extraSauce}: {order.calculated.extraSauce}
        </p>
        <p>
          {t.totalSauce}: {order.calculated.totalSauce}
        </p>
        <p className="mt-2 text-sm text-slate-700">{deliveryText}</p>
      </Card>
      {order.paymentMethod === "bank_transfer" && settings?.bankTransfer.enabled ? (
        <Card title={t.bankTransferOnDelivery}>
          <p>{settings.bankTransfer.bankName}</p>
          <p>{settings.bankTransfer.accountName}</p>
          <p>{settings.bankTransfer.accountNumber}</p>
          <p>{language === "th" ? settings.bankTransfer.noteTh : settings.bankTransfer.noteEn}</p>
        </Card>
      ) : null}
      <Link to="/">
        <Button fullWidth>{language === "th" ? "สั่งอีกครั้ง" : "Order again"}</Button>
      </Link>
    </main>
  );
}
