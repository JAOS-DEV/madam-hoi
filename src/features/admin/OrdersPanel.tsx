import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Select } from "../../components/ui/Select";
import type { Translation } from "../../i18n";
import type { OrderDoc, OrderStatus } from "../../types/firestore";
import { formatDateTime } from "../../utils/dates";
import { formatTHB } from "../../utils/money";
import { archiveOrdersByStatuses, cancelOrderByAdmin, setOrderStatus } from "./adminService";

interface OrdersPanelProps {
  orders: Array<OrderDoc & { id: string }>;
  t: Translation;
}

const statuses: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export function OrdersPanel({ orders, t }: OrdersPanelProps): JSX.Element {
  const [restoreMap, setRestoreMap] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  const statusLabels: Record<OrderStatus, string> = {
    new: t.statusNew,
    confirmed: t.statusConfirmed,
    preparing: t.statusPreparing,
    out_for_delivery: t.statusOutForDelivery,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };
  const visibleOrders = orders.filter((order) =>
    showArchived ? true : order.archivedAt === undefined,
  );

  return (
    <Card title={t.adminOrdersTitle}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => void archiveOrdersByStatuses(["cancelled"])}
        >
          {t.clearCancelledOrders}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void archiveOrdersByStatuses(["completed"])}
        >
          {t.clearFulfilledOrders}
        </Button>
        <label className="ml-1 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          {t.showArchivedOrders}
        </label>
      </div>
      <div className="space-y-4">
        {visibleOrders.map((order) => (
          <article key={order.id} className="rounded-lg border border-slate-200 p-3">
            <p className="font-semibold">{order.orderRef}</p>
            <p className="text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
            <p>{order.customer.name}</p>
            <p>{order.customer.phone}</p>
            <p>{order.customer.deliveryLocation}</p>
            <p>
              {t.total}: {formatTHB(order.calculated.total)} THB
            </p>
            <Select
              label={t.statusLabel}
              value={order.status}
              options={statuses.map((status) => ({ value: status, label: statusLabels[status] }))}
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
              {t.restoreStockOnCancel}
            </label>
            <Button
              variant="danger"
              onClick={() => void cancelOrderByAdmin(order.id, restoreMap[order.id] ?? true)}
            >
              {t.cancelOrderLabel}
            </Button>
          </article>
        ))}
        {visibleOrders.length === 0 ? <p className="text-sm text-slate-500">{t.noOrdersInView}</p> : null}
      </div>
    </Card>
  );
}
