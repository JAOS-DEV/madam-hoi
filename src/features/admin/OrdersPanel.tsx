import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { MapPinPicker } from "../../components/ui/MapPinPicker";
import { Select } from "../../components/ui/Select";
import type { ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, OrderStatus } from "../../types/firestore";
import { formatDateTime, toDateOrNull } from "../../utils/dates";
import { formatTHB } from "../../utils/money";
import {
  archiveAllActiveOrders,
  archiveOrdersByStatuses,
  cancelOrderByAdmin,
  setOrderStatus,
  updateOrderLocation,
} from "./adminService";
import { getAdminErrorMessage } from "./adminToastErrors";

interface OrdersPanelProps {
  orders: Array<OrderDoc & { id: string }>;
  t: Translation;
  language: Language;
  settings: MainSettingsDoc;
  onToast: (message: string, tone: ToastTone) => void;
}

const statuses: OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export function OrdersPanel({ orders, t, language, settings, onToast }: OrdersPanelProps): JSX.Element {
  const [restoreMap, setRestoreMap] = useState<Record<string, boolean>>({});
  const [statusByOrderId, setStatusByOrderId] = useState<Record<string, OrderStatus>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "bank_transfer">("all");
  const [dateRange, setDateRange] = useState<"all" | "day" | "week" | "month">("all");
  const [pickingOrderId, setPickingOrderId] = useState<string | null>(null);

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
      const dateMatch = rangeStart === null ? true : createdDate !== null && createdDate >= rangeStart;
      const searchable = `${order.orderRef} ${order.customer.name} ${order.customer.phone} ${order.customer.deliveryLocation}`.toLowerCase();
      const searchMatch = queryText.length === 0 ? true : searchable.includes(queryText);
      return archivedMatch && statusMatch && paymentMatch && dateMatch && searchMatch;
    });
  }, [dateRange, orders, paymentFilter, search, showArchived, statusFilter]);

  const dispatchAddress = settings.dispatchPoint?.address?.trim() ?? "";
  const dispatchCoords =
    settings.dispatchPoint?.lat !== undefined && settings.dispatchPoint?.lng !== undefined
      ? `${settings.dispatchPoint.lat},${settings.dispatchPoint.lng}`
      : null;

  const routeStops = useMemo(
    () =>
      visibleOrders
        .filter((order) => order.status !== "cancelled")
        .map((order) => ({
          orderRef: order.orderRef,
          value: order.customer.location
            ? `${order.customer.location.lat},${order.customer.location.lng}`
            : order.customer.deliveryLocation.trim(),
          label: order.customer.deliveryLocation,
          hasPin: Boolean(order.customer.location),
        }))
        .filter((entry) => entry.value)
        .slice(0, 10),
    [visibleOrders],
  );

  const handleOrderStatusChange = async (orderId: string, status: OrderStatus): Promise<void> => {
    const previousStatus = statusByOrderId[orderId] ?? orders.find((item) => item.id === orderId)?.status ?? "new";
    setStatusByOrderId((prev) => ({ ...prev, [orderId]: status }));
    setSavingStatusId(orderId);
    try {
      await setOrderStatus(orderId, status);
      onToast(t.toastOrderStatusUpdated, "success");
    } catch (error) {
      setStatusByOrderId((prev) => ({ ...prev, [orderId]: previousStatus }));
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setSavingStatusId(null);
    }
  };

  const handleCancelOrder = async (orderId: string, restoreStock: boolean): Promise<void> => {
    try {
      await cancelOrderByAdmin(orderId, restoreStock);
      onToast(t.toastOrderCancelled, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    }
  };

  const handleArchiveOrders = async (targetStatuses: OrderStatus[]): Promise<void> => {
    try {
      await archiveOrdersByStatuses(targetStatuses);
      onToast(t.toastOrdersArchived, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    }
  };

  const handleClearAllOrders = async (): Promise<void> => {
    const confirmed = window.confirm(
      language === "th"
        ? "ยืนยันล้างออเดอร์ทั้งหมดในหน้าดูแลระบบ?"
        : "Are you sure you want to clear all active orders?",
    );
    if (!confirmed) {
      return;
    }
    try {
      const count = await archiveAllActiveOrders();
      onToast(
        language === "th" ? `ล้างออเดอร์แล้ว ${count} รายการ` : `Cleared ${count} orders.`,
        "success",
      );
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    }
  };

  const handleUpdateOrderLocation = async (orderId: string, location: { lat: number; lng: number }): Promise<void> => {
    try {
      await updateOrderLocation(orderId, location);
      onToast(t.toastLocationUpdated, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    }
  };

  const openRouteInMaps = (): void => {
    const originValue = dispatchCoords ?? dispatchAddress;
    if (!originValue.trim()) {
      window.alert(t.routeNoDispatchPoint);
      return;
    }
    if (routeStops.length === 0) {
      window.alert(t.routeNoOrdersForRoute);
      return;
    }
    const destination = routeStops[routeStops.length - 1].value;
    const waypoints = routeStops.slice(0, -1).map((item) => item.value);
    const encodedOrigin = encodeURIComponent(originValue);
    const encodedDestination = encodeURIComponent(destination);
    const waypointParam =
      waypoints.length > 0
        ? `&waypoints=${waypoints.map((item) => encodeURIComponent(item)).join("%7C")}`
        : "";
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=driving${waypointParam}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card title={t.adminOrdersTitle} collapsible collapseStorageKey="admin.section.orders">
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button size="compact" variant={dateRange === "all" ? "primary" : "secondary"} onClick={() => setDateRange("all")}>
            {t.statsRangeAll}
          </Button>
          <Button size="compact" variant={dateRange === "day" ? "primary" : "secondary"} onClick={() => setDateRange("day")}>
            {t.statsRangeDay}
          </Button>
          <Button size="compact" variant={dateRange === "week" ? "primary" : "secondary"} onClick={() => setDateRange("week")}>
            {t.statsRangeWeek}
          </Button>
          <Button size="compact" variant={dateRange === "month" ? "primary" : "secondary"} onClick={() => setDateRange("month")}>
            {t.statsRangeMonth}
          </Button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <Button size="compact" onClick={openRouteInMaps}>
          {t.openRouteInMaps}
        </Button>
        <Button size="compact" variant="secondary" onClick={() => void handleArchiveOrders(["cancelled"])}>
          {t.clearCancelledOrders}
        </Button>
        <Button size="compact" variant="secondary" onClick={() => void handleArchiveOrders(["completed"])}>
          {t.clearFulfilledOrders}
        </Button>
        <Button size="compact" variant="danger" onClick={() => void handleClearAllOrders()}>
          {language === "th" ? "ล้างทั้งหมด" : "Clear all"}
        </Button>
        <label className="ml-1 flex items-center gap-2 text-sm text-slate-700 lg:ml-2">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          {t.showArchivedOrders}
        </label>
      </div>

      <p className="mb-3 text-xs text-slate-600">{t.routeStopsLimitedNote}</p>
      <details className="group mb-3 rounded-lg border border-brand-gold/30 bg-white/70 p-3">
        <summary className="relative cursor-pointer list-none pr-6">
          <span className="absolute right-0 top-0 inline-block text-xs text-slate-500 transition-transform group-open:rotate-180">
            ˅
          </span>
          <p className="text-sm font-semibold text-brand-redDark">{t.routePreviewTitle}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t.routePreviewOrigin}: {(dispatchCoords ?? dispatchAddress) || "-"}
          </p>
        </summary>
        <div className="mt-2 space-y-1 text-xs text-slate-700">
          {routeStops.length === 0 ? (
            <p>{t.routeNoOrdersForRoute}</p>
          ) : (
            routeStops.map((stop, index) => (
              <p key={`${stop.orderRef}-${index}`}>
                {t.routePreviewStop} {index + 1}: {stop.label} ({stop.orderRef}
                {stop.hasPin ? ", pin" : ""})
              </p>
            ))
          )}
        </div>
      </details>

      <div className="space-y-2">
        {visibleOrders.map((order) => (
          <details key={order.id} className="group rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <summary className="relative cursor-pointer list-none pr-7">
              <span className="absolute right-0 top-1 inline-block text-sm text-slate-500 transition-transform group-open:rotate-180">
                ˅
              </span>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-slate-500">{language === "th" ? "เลขออเดอร์" : "Order ref"}</p>
                    <p className="font-semibold text-brand-redDark">{order.orderRef}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500">{language === "th" ? "สถานะ" : "Status"}</p>
                    <p className="font-medium">{statusLabels[statusByOrderId[order.id] ?? order.status]}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <p>
                    <span className="block text-[10px] text-slate-500">{language === "th" ? "ลูกค้า" : "Customer"}</span>
                    {order.customer.name}
                  </p>
                  <p className="text-right">
                    <span className="block text-[10px] text-slate-500">{language === "th" ? "ยอดรวม" : "Total"}</span>
                    {formatTHB(order.calculated.total)} THB
                  </p>
                  <p className="col-span-2 truncate">
                    <span className="block text-[10px] text-slate-500">
                      {language === "th" ? "ที่อยู่จัดส่ง" : "Delivery location"}
                    </span>
                    {order.customer.deliveryLocation}
                  </p>
                  <p className="col-span-2 text-[10px] text-slate-500">
                    {language === "th" ? "สร้างเมื่อ" : "Created at"}: {formatDateTime(order.createdAt)}
                  </p>
                </div>
              </div>
            </summary>
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-sm">
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <p>
                  <span className="block text-[10px] text-slate-500">{language === "th" ? "โทรศัพท์" : "Phone"}</span>
                  {order.customer.phone}
                </p>
                <p>
                  <span className="block text-[10px] text-slate-500">{language === "th" ? "วิธีจ่ายเงิน" : "Payment"}</span>
                  {order.paymentMethod === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
                </p>
              </div>
              {order.customer.location ? (
                <p className="text-xs text-slate-500">
                  {language === "th" ? "พิกัด" : "Pin"}: Lat {order.customer.location.lat.toFixed(6)}, Lng{" "}
                  {order.customer.location.lng.toFixed(6)}
                </p>
              ) : null}
              <div className="space-y-2 rounded-lg border border-slate-200 p-2">
                <Select
                  label={t.statusLabel}
                  value={statusByOrderId[order.id] ?? order.status}
                  options={statuses.map((status) => ({ value: status, label: statusLabels[status] }))}
                  onChange={(event) => {
                    void handleOrderStatusChange(order.id, event.target.value as OrderStatus);
                  }}
                />
                {savingStatusId === order.id ? (
                  <p className="text-xs text-slate-500">{language === "th" ? "กำลังบันทึกสถานะ..." : "Saving status..."}</p>
                ) : null}
              </div>
              <div className="space-y-2 rounded-lg border border-slate-200 p-2">
                <label className="flex items-center gap-2 text-sm">
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
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  size="compact"
                  variant="danger"
                  onClick={() => void handleCancelOrder(order.id, restoreMap[order.id] ?? true)}
                >
                  {t.cancelOrderLabel}
                </Button>
                <Button size="compact" variant="secondary" onClick={() => setPickingOrderId(order.id)}>
                  {t.pickPinOnMap}
                </Button>
              </div>
            </div>
          </details>
        ))}
        {visibleOrders.length === 0 ? <p className="text-sm text-slate-500">{t.noOrdersInView}</p> : null}
      </div>

      <MapPinPicker
        isOpen={pickingOrderId !== null}
        title={t.pickPinOnMap}
        initialLat={
          pickingOrderId
            ? visibleOrders.find((order) => order.id === pickingOrderId)?.customer.location?.lat
            : undefined
        }
        initialLng={
          pickingOrderId
            ? visibleOrders.find((order) => order.id === pickingOrderId)?.customer.location?.lng
            : undefined
        }
        onClose={() => setPickingOrderId(null)}
        onConfirm={(lat, lng) => {
          if (pickingOrderId) {
            void handleUpdateOrderLocation(pickingOrderId, { lat, lng });
          }
          setPickingOrderId(null);
        }}
      />
    </Card>
  );
}
