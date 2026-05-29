import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { ToastTone } from "../../hooks/useToast";
import type { Translation } from "../../i18n";
import type { StockDoc } from "../../types/firestore";
import { getAdminErrorMessage } from "./adminToastErrors";
import { updateStock } from "./adminService";

interface StockPanelProps {
  stock: StockDoc;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
}

export function StockPanel({ stock, t, onToast }: StockPanelProps): JSX.Element {
  const [kg, setKg] = useState((stock.availableHoiGrams / 1000).toString());
  const [openerStock, setOpenerStock] = useState(stock.openerStock.toString());
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    const kgValue = Number(kg);
    const openerValue = Number(openerStock);
    if (!Number.isFinite(kgValue) || !Number.isFinite(openerValue) || kgValue < 0 || openerValue < 0) {
      onToast(t.toastGenericError, "error");
      return;
    }

    setIsSaving(true);
    try {
      await updateStock(kgValue, openerValue);
      onToast(t.toastStockSaved, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card title={t.adminStockTitle} collapsible collapseStorageKey="admin.section.stock">
      <div className="space-y-3">
        <Input
          label={t.availableHoiStockKg}
          type="number"
          step="0.1"
          value={kg}
          onChange={(event) => setKg(event.target.value)}
        />
        <Input
          label={t.openerStockLabel}
          type="number"
          value={openerStock}
          onChange={(event) => setOpenerStock(event.target.value)}
        />
        <Button onClick={() => void handleSave()} disabled={isSaving} aria-busy={isSaving}>
          {isSaving ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
          ) : null}
          {t.saveStock}
        </Button>
      </div>
    </Card>
  );
}
