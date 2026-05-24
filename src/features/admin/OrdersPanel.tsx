import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import type { OrderDoc, OrderStatus } from "../../types/firestore";
import { formatDateTime } from "../../utils/dates";
import { formatTHB } from "../../utils/money";
import { cancelOrderByAdmin, setOrderStatus } from "./adminService";

interface OrdersPanelProps {
  orders: Array<OrderDoc & { id: string }>;
}

const statuses: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export function OrdersPanel({ orders }: OrdersPanelProps): JSX.Element {
  const [restoreMap, setRestoreMap] = useState<Record<string, boolean>>({});

  return (
    <Card title="Orders dashboard">
      <div className="space-y-4">
        {orders.map((order) => (
          <article key={order.id} className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold">{order.orderRef}</p>
            <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
            <p>{order.customer.name}</p>
            <p>{order.customer.phone}</p>
            <p>{order.customer.deliveryLocation}</p>
            <p>Total: {formatTHB(order.calculated.total)} THB</p>
            <Select
              label="Status"
              value={order.status}
              options={statuses.map((status) => ({ value: status, label: status }))}
              onChange={(event) => {
                void setOrderStatus(order.id, event.target.value as OrderStatus);
              }}
            />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={restoreMap[order.id] ?? true}
                onChange={(event) =>
                  setRestoreMap((prev) => ({
                    ...prev,
                    [order.id]: event.target.checked,
                  }))
                }
              />
              Restore stock on cancel
            </label>
            <Button
              variant="danger"
              onClick={() => void cancelOrderByAdmin(order.id, restoreMap[order.id] ?? true)}
            >
              Cancel order
            </Button>
          </article>
        ))}
      </div>
    </Card>
  );
}
