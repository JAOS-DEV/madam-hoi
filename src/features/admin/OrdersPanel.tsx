import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, OrderStatus } from "../../types/firestore";
import { formatDateTime, toDateOrNull } from "../../utils/dates";
import { formatTHB } from "../../utils/money";
import { archiveOrdersByStatuses, cancelOrderByAdmin, setOrderStatus } from "./adminService";

interface OrdersPanelProps {
  orders: Array<OrderDoc & { id: string }>;
  t: Translation;
  settings: MainSettingsDoc;
}

const statuses: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export function OrdersPanel({ orders, t, settings }: OrdersPanelProps): JSX.Element {
  const [restoreMap, setRestoreMap] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "bank_transfer">("all");
  const [dateRange, setDateRange] = useState<"all" | "day" | "week" | "month">("all");
  const statusLabels: Record<OrderStatus, string> = {
    new: t.statusNew,
    confirmed: t.statusConfirmed,
    preparing: t.statusPreparing,
    out_for_delivery: t.statusOutForDelivery,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };
  const visibleOrders = useMemo(() => {
    const queryText = search.trim().toLowerCase();
    const now = new Date();
    const rangeStart = (() => {
      if (dateRange === "all") {
        return null;
      }
      const start = new Date(now);
      if (dateRange === "day") {
        start.setHours(0, 0, 0, 0);
        return start;
      }
      if (dateRange === "week") {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return start;
      }
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    })();

    return orders.filter((order) => {
      const archivedMatch = showArchived ? true : order.archivedAt === undefined;
      const statusMatch = statusFilter === "all" ? true : order.status === statusFilter;
      const paymentMatch = paymentFilter === "all" ? true : order.paymentMethod === paymentFilter;
      const createdDate = toDateOrNull(order.createdAt);
      const dateMatch =
        rangeStart === null ? true : createdDate !== null && createdDate >= rangeStart;
      const searchable = `${order.orderRef} ${order.customer.name} ${order.customer.phone} ${order.customer.deliveryLocation}`.toLowerCase();
      const searchMatch = queryText.length === 0 ? true : searchable.includes(queryText);
      return archivedMatch && statusMatch && paymentMatch && dateMatch && searchMatch;
    });
  }, [dateRange, orders, paymentFilter, search, showArchived, statusFilter]);

  const openRouteInMaps = (): void => {
    const dispatchAddress = settings.dispatchPoint?.address?.trim();
    if (!dispatchAddress) {
      window.alert(t.routeNoDispatchPoint);
      return;
    }
    const stops = visibleOrders
      .filter((order) => order.status !== "cancelled")
      .map((order) => order.customer.deliveryLocation.trim())
      .filter(Boolean);
    if (stops.length === 0) {
      window.alert(t.routeNoOrdersForRoute);
      return;
    }
    const limitedStops = stops.slice(0, 10);
    const destination = limitedStops[limitedStops.length - 1];
    const waypoints = limitedStops.slice(0, -1);
    const encodedOrigin = encodeURIComponent(dispatchAddress);
    const encodedDestination = encodeURIComponent(destination);
    const waypointParam =
      waypoints.length > 0
        ? `&waypoints=${waypoints.map((item) => encodeURIComponent(item)).join("%7C")}`
        : "";
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=driving${waypointParam}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card title={t.adminOrdersTitle}>
      <div className="mb-3 space-y-2 rounded-lg border border-brand-gold/30 bg-white/70 p-3">
        <p className="text-sm font-semibold text-brand-redDark">{t.orderFiltersTitle}</p>
        <Input
          label={t.orderSearchLabel}
          placeholder={t.searchOrdersPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            label={t.statusLabel}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | OrderStatus)}
            options={[
              { value: "all", label: t.allStatusesLabel },
              ...statuses.map((status) => ({ value: status, label: statusLabels[status] })),
            ]}
          />
          <Select
            label={t.paymentFilterLabel}
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as "all" | "cash" | "bank_transfer")}
            options={[
              { value: "all", label: t.allPaymentsLabel },
              { value: "cash", label: t.cashOnDelivery },
              { value: "bank_transfer", label: t.bankTransferOnDelivery },
            ]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={dateRange === "all" ? "primary" : "secondary"}
            onClick={() => setDateRange("all")}
          >
            {t.statsRangeAll}
          </Button>
          <Button
            variant={dateRange === "day" ? "primary" : "secondary"}
            onClick={() => setDateRange("day")}
          >
            {t.statsRangeDay}
          </Button>
          <Button
            variant={dateRange === "week" ? "primary" : "secondary"}
            onClick={() => setDateRange("week")}
          >
            {t.statsRangeWeek}
          </Button>
          <Button
            variant={dateRange === "month" ? "primary" : "secondary"}
            onClick={() => setDateRange("month")}
          >
            {t.statsRangeMonth}
          </Button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button onClick={openRouteInMaps}>{t.openRouteInMaps}</Button>
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
      <p className="mb-3 text-xs text-slate-600">{t.routeStopsLimitedNote}</p>
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
