import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { ToastTone } from "../../hooks/useToast";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc } from "../../types/firestore";
import { getAdminErrorMessage } from "./adminToastErrors";
import { updateSettingsPatch } from "./adminService";

interface ProductSettingsPanelProps {
  settings: MainSettingsDoc;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
}

export function ProductSettingsPanel({ settings, t, onToast }: ProductSettingsPanelProps): JSX.Element {
  const [state, setState] = useState(settings.productSettings);
  const [isSaving, setIsSaving] = useState(false);

  const save = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await updateSettingsPatch({ productSettings: state });
      onToast(t.toastProductSettingsSaved, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card title={t.adminProductTitle} collapsible collapseStorageKey="admin.section.product-settings">
      <div className="space-y-3">
        <Input
          label={t.regularPriceLabel}
          type="number"
          value={state.regular.price}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              regular: { ...prev.regular, price: Number(event.target.value) },
            }))
          }
        />
        <Input
          label={t.regularDeductionLabel}
          type="number"
          value={state.regular.deductionGrams}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              regular: { ...prev.regular, deductionGrams: Number(event.target.value) },
            }))
          }
        />
        <Input
          label={t.smallPriceLabel}
          type="number"
          value={state.small.price}
          onChange={(event) =>
            setState((prev) => ({ ...prev, small: { ...prev.small, price: Number(event.target.value) } }))
          }
        />
        <Input
          label={t.smallDeductionLabel}
          type="number"
          value={state.small.deductionGrams}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              small: { ...prev.small, deductionGrams: Number(event.target.value) },
            }))
          }
        />
        <Input
          label={t.extraSaucePriceLabel}
          type="number"
          value={state.extraSauce.price}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              extraSauce: { ...prev.extraSauce, price: Number(event.target.value) },
            }))
          }
        />
        <Input
          label={t.openerPriceLabel}
          type="number"
          value={state.opener.price}
          onChange={(event) =>
            setState((prev) => ({ ...prev, opener: { ...prev.opener, price: Number(event.target.value) } }))
          }
        />
        <Button onClick={() => void save()} disabled={isSaving} aria-busy={isSaving}>
          {isSaving ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
          ) : null}
          {t.saveProducts}
        </Button>
      </div>
    </Card>
  );
}
