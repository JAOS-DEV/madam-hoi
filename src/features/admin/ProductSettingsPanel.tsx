import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { MainSettingsDoc } from "../../types/firestore";
import { updateSettingsPatch } from "./adminService";

interface ProductSettingsPanelProps {
  settings: MainSettingsDoc;
}

export function ProductSettingsPanel({ settings }: ProductSettingsPanelProps): JSX.Element {
  const [state, setState] = useState(settings.productSettings);

  const save = async (): Promise<void> => {
    await updateSettingsPatch({ productSettings: state });
  };

  return (
    <Card title="Product settings">
      <div className="space-y-3">
        <Input
          label="Regular price"
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
          label="Regular deduction grams"
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
          label="Small price"
          type="number"
          value={state.small.price}
          onChange={(event) =>
            setState((prev) => ({ ...prev, small: { ...prev.small, price: Number(event.target.value) } }))
          }
        />
        <Input
          label="Small deduction grams"
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
          label="Extra sauce price"
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
          label="Hoi opener price"
          type="number"
          value={state.opener.price}
          onChange={(event) =>
            setState((prev) => ({ ...prev, opener: { ...prev.opener, price: Number(event.target.value) } }))
          }
        />
        <Button onClick={save}>Save products</Button>
      </div>
    </Card>
  );
}
