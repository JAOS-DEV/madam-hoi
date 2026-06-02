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

const nextStatusByStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  confirmed: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "completed",
};

function getStatusBadgeClass(status: OrderStatus): string {
  if (status === "new") {
    return "bg-amber-100 text-amber-900";
  }
  if (status === "confirmed") {
    return "bg-blue-100 text-blue-900";
  }
  if (status === "preparing") {
    return "bg-purple-100 text-purple-900";
  }
  if (status === "out_for_delivery") {
    return "bg-orange-100 text-orange-900";
  }
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-900";
  }
  return "bg-slate-200 text-slate-700";
}

function getOrderItemSummary(order: OrderDoc & { id: string }, language: Language): string {
  const itemLabels = order.itemSnapshot
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity} ${language === "th" ? item.thaiLabel : item.label}`);
  return itemLabels.join(", ");
}

function getNextActionLabel(status: OrderStatus, language: Language): string | null {
  if (status === "new") {
    return language === "th" ? "ยืนยัน" : "Confirm";
  }
  if (status === "confirmed") {
    return language === "th" ? "เริ่มเตรียม" : "Start preparing";
  }
  if (status === "preparing") {
    return language === "th" ? "ออกจัดส่ง" : "Out for delivery";
  }
  if (status === "out_for_delivery") {
    return language === "th" ? "เสร็จสิ้น" : "Complete";
  }
  return null;
}

export function OrdersPanel({ orders, t, language, settings, onToast }: OrdersPanelProps): JSX.Element {
  const [restoreMap, setRestoreMap] = useState<Record<string, boolean>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus>("new");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "bank_transfer">("all");
  const [dateRange, setDateRange] = useState<"all" | "day" | "week" | "month">("all");
  const [pickingOrderId, setPickingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const statusLabels: Record<OrderStatus, string> = {
    new: t.statusNew,
    confirmed: t.statusConfirmed,
    preparing: t.statusPreparing,
    out_for_delivery: t.statusOutForDelivery,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };

  const activeOrders = useMemo(
    () => orders.filter((order) => (showArchived ? true : order.archivedAt === undefined)),
    [orders, showArchived],
  );

  const statusCounts = useMemo(
    () =>
      activeOrders.reduce<Record<OrderStatus, number>>(
        (acc, order) => {
          acc[order.status] += 1;
          return acc;
        },
        {
          new: 0,
          confirmed: 0,
          preparing: 0,
          out_for_delivery: 0,
          completed: 0,
          cancelled: 0,
        },
      ),
    [activeOrders],
  );

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
      const statusMatch = order.status === statusFilter;
      const paymentMatch = paymentFilter === "all" ? true : order.paymentMethod === paymentFilter;
      const createdDate = toDateOrNull(order.createdAt);
      const dateMatch = rangeStart === null ? true : createdDate !== null && createdDate >= rangeStart;
      const searchable = `${order.orderRef} ${order.customer.name} ${order.customer.phone} ${order.customer.deliveryLocation}`.toLowerCase();
      const searchMatch = queryText.length === 0 ? true : searchable.includes(queryText);
      return archivedMatch && statusMatch && paymentMatch && dateMatch && searchMatch;
    });
  }, [dateRange, orders, paymentFilter, search, showArchived, statusFilter]);

  const selectedOrder = selectedOrderId ? orders.find((order) => order.id === selectedOrderId) : null;

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
    setSavingStatusId(orderId);
    try {
      await setOrderStatus(orderId, status);
      onToast(t.toastOrderStatusUpdated, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setSavingStatusId(null);
    }
  };

  const handleCopy = async (value: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      onToast(language === "th" ? `คัดลอก${label}แล้ว` : `${label} copied.`, "success");
    } catch {
      onToast(language === "th" ? "คัดลอกไม่สำเร็จ" : "Copy failed.", "error");
    }
  };

  const openOrderInMaps = (order: OrderDoc & { id: string }): void => {
    const destination = order.customer.location
      ? `${order.customer.location.lat},${order.customer.location.lng}`
      : order.customer.deliveryLocation.trim();
    if (!destination) {
      window.alert(t.routeNoOrdersForRoute);
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`,
      "_blank",
      "noopener,noreferrer",
    );
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
    <Card title={language === "th" ? "ออเดอร์" : "Orders"}>
      <div className="mb-3 space-y-2 rounded-lg border border-brand-gold/30 bg-white/70 p-3">
        <p className="text-sm font-semibold text-brand-redDark">
          {language === "th" ? "งานออเดอร์" : "Order work queue"}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold ${
                statusFilter === status
                  ? "bg-brand-red text-white"
                  : "border border-brand-gold/40 bg-brand-cream text-brand-redDark"
              }`}
            >
              {statusLabels[status]} ({statusCounts[status]})
            </button>
          ))}
        </div>
        <Input
          label={t.orderSearchLabel}
          placeholder={t.searchOrdersPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2">
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
          <label className="flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-white px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            {t.showArchivedOrders}
          </label>
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

      <details className="mb-3 rounded-lg border border-brand-gold/30 bg-white/70 p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-brand-redDark">
          {language === "th" ? "เครื่องมือเส้นทางและการเก็บออเดอร์" : "Route and archive tools"}
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
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
        </div>
        <p className="mt-3 text-xs text-slate-600">{t.routeStopsLimitedNote}</p>
        <div className="mt-3 rounded-lg border border-brand-gold/30 bg-white/80 p-3">
          <p className="text-sm font-semibold text-brand-redDark">{t.routePreviewTitle}</p>
          <p className="mt-1 text-xs text-slate-600">
            {t.routePreviewOrigin}: {(dispatchCoords ?? dispatchAddress) || "-"}
          </p>
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
        </div>
      </details>

      <div className="space-y-2">
        {visibleOrders.map((order) => {
          const nextStatus = nextStatusByStatus[order.status];
          const nextActionLabel = getNextActionLabel(order.status, language);
          return (
            <article key={order.id} className="rounded-xl border border-brand-gold/30 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedOrderId(order.id)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-brand-redDark">{order.orderRef}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusBadgeClass(order.status)}`}>
                        {statusLabels[order.status]}
                      </span>
                      {order.customer.notes ? (
                        <span className="rounded-full bg-brand-cream px-2 py-1 text-[10px] text-brand-redDark">
                          {language === "th" ? "มีโน้ต" : "Notes"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800">{order.customer.name}</p>
                    <p className="text-xs text-slate-600">{order.customer.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-redDark">{formatTHB(order.calculated.total)} THB</p>
                    <p className="text-[10px] text-slate-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-2 truncate text-xs text-slate-600">{order.customer.deliveryLocation}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-700">{getOrderItemSummary(order, language)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {order.paymentMethod === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
                </p>
              </button>
              {nextStatus && nextActionLabel ? (
                <div className="mt-3">
                  <Button
                    fullWidth
                    size="compact"
                    onClick={() => void handleOrderStatusChange(order.id, nextStatus)}
                    disabled={savingStatusId === order.id}
                  >
                    {savingStatusId === order.id ? (
                      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
                    ) : null}
                    {nextActionLabel}
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
        {visibleOrders.length === 0 ? <p className="text-sm text-slate-500">{t.noOrdersInView}</p> : null}
      </div>

      {selectedOrder ? (
        <div className="fixed inset-0 z-40 flex items-end bg-slate-950/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:mx-auto sm:max-w-2xl sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">{language === "th" ? "รายละเอียดออเดอร์" : "Order details"}</p>
                <h3 className="text-xl font-bold text-brand-redDark">{selectedOrder.orderRef}</h3>
              </div>
              <Button size="compact" variant="secondary" onClick={() => setSelectedOrderId(null)}>
                {language === "th" ? "ปิด" : "Close"}
              </Button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-brand-gold/30 bg-brand-cream/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-brand-redDark">{selectedOrder.customer.name}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {statusLabels[selectedOrder.status]}
                  </span>
                </div>
                <p>{selectedOrder.customer.phone}</p>
                <p>{selectedOrder.customer.deliveryLocation}</p>
                {selectedOrder.customer.notes ? (
                  <p className="mt-2 rounded-lg bg-white p-2 text-xs text-slate-700">
                    {selectedOrder.customer.notes}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button size="compact" variant="secondary" onClick={() => window.open(`tel:${selectedOrder.customer.phone}`)}>
                  {language === "th" ? "โทรหาลูกค้า" : "Call customer"}
                </Button>
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() => void handleCopy(selectedOrder.customer.phone, language === "th" ? "เบอร์โทร" : "Phone")}
                >
                  {language === "th" ? "คัดลอกเบอร์" : "Copy phone"}
                </Button>
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() =>
                    void handleCopy(
                      selectedOrder.customer.deliveryLocation,
                      language === "th" ? "ที่อยู่" : "Address",
                    )
                  }
                >
                  {language === "th" ? "คัดลอกที่อยู่" : "Copy address"}
                </Button>
                <Button size="compact" variant="secondary" onClick={() => openOrderInMaps(selectedOrder)}>
                  {language === "th" ? "เปิดแผนที่" : "Open map"}
                </Button>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 font-semibold text-brand-redDark">{language === "th" ? "รายการสินค้า" : "Items"}</p>
                <div className="space-y-1">
                  {selectedOrder.itemSnapshot.map((item) => (
                    <div key={`${item.productId}-${item.label}`} className="flex justify-between gap-3 text-xs">
                      <span>
                        {item.quantity} x {language === "th" ? item.thaiLabel : item.label}
                      </span>
                      <span>{formatTHB(item.lineTotal)} THB</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <p className="rounded-lg border border-slate-200 p-2">
                  <span className="block text-slate-500">{language === "th" ? "น้ำจิ้มที่รวม" : "Included sauces"}</span>
                  {selectedOrder.calculated.includedSauce}
                </p>
                <p className="rounded-lg border border-slate-200 p-2">
                  <span className="block text-slate-500">{language === "th" ? "น้ำจิ้มเพิ่ม" : "Extra sauces"}</span>
                  {selectedOrder.calculated.extraSauce}
                </p>
                <p className="rounded-lg border border-slate-200 p-2">
                  <span className="block text-slate-500">{t.totalSauce}</span>
                  {selectedOrder.calculated.totalSauce}
                </p>
                <p className="rounded-lg border border-slate-200 p-2">
                  <span className="block text-slate-500">{language === "th" ? "หักสต็อก" : "Hoi deducted"}</span>
                  {selectedOrder.calculated.hoiGramsDeducted}g
                </p>
              </div>

              {selectedOrder.calculated.packagingDeducted ? (
                <div className="rounded-lg border border-slate-200 p-3 text-xs">
                  <p className="font-semibold text-brand-redDark">
                    {language === "th" ? "บรรจุภัณฑ์ที่หัก" : "Packaging deducted"}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <p>
                      <span className="block text-slate-500">{language === "th" ? "ชุดใหญ่" : "Regular"}</span>
                      {selectedOrder.calculated.packagingDeducted.regularPacks}
                    </p>
                    <p>
                      <span className="block text-slate-500">{language === "th" ? "ชุดเล็ก" : "Small"}</span>
                      {selectedOrder.calculated.packagingDeducted.smallPacks}
                    </p>
                    <p>
                      <span className="block text-slate-500">{language === "th" ? "น้ำจิ้ม" : "Sauce cups"}</span>
                      {selectedOrder.calculated.packagingDeducted.sauceCups}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200 p-3 text-xs">
                <p>
                  <span className="font-semibold">{t.paymentMethod}: </span>
                  {selectedOrder.paymentMethod === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
                </p>
                <p>
                  <span className="font-semibold">{t.total}: </span>
                  {formatTHB(selectedOrder.calculated.total)} THB
                </p>
                <p>
                  <span className="font-semibold">{language === "th" ? "ข้อความจัดส่งตอนสั่ง: " : "Delivery snapshot: "}</span>
                  {language === "th" ? selectedOrder.deliveryMessageSnapshot.th : selectedOrder.deliveryMessageSnapshot.en}
                </p>
                <p>
                  <span className="font-semibold">{language === "th" ? "สร้างเมื่อ: " : "Created: "}</span>
                  {formatDateTime(selectedOrder.createdAt)}
                </p>
                <p>
                  <span className="font-semibold">{language === "th" ? "อัปเดตล่าสุด: " : "Updated: "}</span>
                  {formatDateTime(selectedOrder.updatedAt)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <Select
                  label={t.statusLabel}
                  value={selectedOrder.status}
                  options={statuses.map((status) => ({ value: status, label: statusLabels[status] }))}
                  onChange={(event) => {
                    void handleOrderStatusChange(selectedOrder.id, event.target.value as OrderStatus);
                  }}
                />
                {savingStatusId === selectedOrder.id ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {language === "th" ? "กำลังบันทึกสถานะ..." : "Saving status..."}
                  </p>
                ) : null}
              </div>

              {selectedOrder.status !== "completed" ? (
                <div className="space-y-2 rounded-lg border border-red-100 bg-red-50 p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={restoreMap[selectedOrder.id] ?? true}
                      onChange={(event) =>
                        setRestoreMap((prev) => ({
                          ...prev,
                          [selectedOrder.id]: event.target.checked,
                        }))
                      }
                    />
                    {t.restoreStockOnCancel}
                  </label>
                  <Button
                    fullWidth
                    size="compact"
                    variant="danger"
                    onClick={() => void handleCancelOrder(selectedOrder.id, restoreMap[selectedOrder.id] ?? true)}
                  >
                    {t.cancelOrderLabel}
                  </Button>
                </div>
              ) : null}

              <Button fullWidth size="compact" variant="secondary" onClick={() => setPickingOrderId(selectedOrder.id)}>
                {t.pickPinOnMap}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
