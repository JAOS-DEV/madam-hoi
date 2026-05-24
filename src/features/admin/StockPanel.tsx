import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { StockDoc } from "../../types/firestore";
import { updateStock } from "./adminService";

interface StockPanelProps {
  stock: StockDoc;
}

export function StockPanel({ stock }: StockPanelProps): JSX.Element {
  const [kg, setKg] = useState((stock.availableHoiGrams / 1000).toString());
  const [openerStock, setOpenerStock] = useState(stock.openerStock.toString());

  const handleSave = async (): Promise<void> => {
    await updateStock(Number(kg), Number(openerStock));
  };

  return (
    <Card title="Today's stock">
      <div className="space-y-3">
        <Input
          label="Available hoi stock today (kg)"
          type="number"
          step="0.1"
          value={kg}
          onChange={(event) => setKg(event.target.value)}
        />
        <Input
          label="Hoi opener stock"
          type="number"
          value={openerStock}
          onChange={(event) => setOpenerStock(event.target.value)}
        />
        <Button onClick={handleSave}>Save stock</Button>
      </div>
    </Card>
  );
}
