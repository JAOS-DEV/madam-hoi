import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { MapPinPicker } from "../../components/ui/MapPinPicker";
import { Select } from "../../components/ui/Select";
import type { ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, OrderStatus } from "../../types/firestore";
import { formatDateTime, toDateOrNull } from "../../utils/dates";
import { reverseGeocodeAddress } from "../../utils/geocoding";
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

function OrderFieldLabel({ children }: { children: string }): JSX.Element {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

function getOrderItemSummary(order: OrderDoc & { id: string }, language: Language): string {
  const itemLabels = order.itemSnapshot
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity} ${language === "th" ? item.thaiLabel : item.label}`);
  return itemLabels.join(", ");
}

interface OrderDetailExpandProps {
  order: OrderDoc & { id: string };
  language: Language;
  t: Translation;
  statusLabels: Record<OrderStatus, string>;
  statuses: OrderStatus[];
  nextStatus: OrderStatus | undefined;
  nextActionLabel: string | null;
  savingStatusId: string | null;
  restoreMap: Record<string, boolean>;
  resolvingLocationOrderId: string | null;
  onAdvanceStatus: (orderId: string, status: OrderStatus) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onCopy: (value: string, label: string) => void;
  onOpenMaps: (order: OrderDoc & { id: string }) => void;
  onCancel: (orderId: string, restoreStock: boolean) => void;
  onRestoreMapChange: (orderId: string, restoreStock: boolean) => void;
  onPickPin: (orderId: string) => void;
}

function OrderDetailExpand({
  order,
  language,
  t,
  statusLabels,
  statuses,
  nextStatus,
  nextActionLabel,
  savingStatusId,
  restoreMap,
  resolvingLocationOrderId,
  onAdvanceStatus,
  onStatusChange,
  onCopy,
  onOpenMaps,
  onCancel,
  onRestoreMapChange,
  onPickPin,
}: OrderDetailExpandProps): JSX.Element {
  const isSaving = savingStatusId === order.id;

  return (
    <div className="mt-4 space-y-4 border-t border-brand-gold/30 pt-4">
      <div className="rounded-lg border border-brand-gold/30 bg-white p-3.5">
        <OrderFieldLabel>{language === "th" ? "รายการสินค้า" : "Items"}</OrderFieldLabel>
        <div className="mt-2 space-y-2">
          {order.itemSnapshot
            .filter((item) => item.quantity > 0)
            .map((item) => (
              <div key={`${item.productId}-${item.label}`} className="flex justify-between gap-3 text-sm text-slate-800">
                <span>
                  {item.quantity} x {language === "th" ? item.thaiLabel : item.label}
                </span>
                <span className="shrink-0 font-medium">{formatTHB(item.lineTotal)} THB</span>
              </div>
            ))}
        </div>
        <p className="mt-3 border-t border-brand-gold/20 pt-2 text-right text-sm font-semibold text-brand-redDark">
          {t.total}: {formatTHB(order.calculated.total)} THB
        </p>
      </div>

      <div>
        <OrderFieldLabel>{language === "th" ? "ติดต่อและจัดส่ง" : "Contact & delivery"}</OrderFieldLabel>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button type="button" fullWidth size="compact" variant="secondary" onClick={() => window.open(`tel:${order.customer.phone}`)}>
            {language === "th" ? "โทรลูกค้า" : "Call customer"}
          </Button>
          <Button
            type="button"
            fullWidth
            size="compact"
            variant="secondary"
            onClick={() => void onCopy(order.customer.phone, language === "th" ? "เบอร์โทร" : "Phone")}
          >
            {language === "th" ? "คัดลอกเบอร์" : "Copy phone"}
          </Button>
          <Button
            type="button"
            fullWidth
            size="compact"
            variant="secondary"
            onClick={() => void onCopy(order.customer.deliveryLocation, language === "th" ? "ที่อยู่" : "Address")}
          >
            {language === "th" ? "คัดลอกที่อยู่" : "Copy address"}
          </Button>
          <Button type="button" fullWidth size="compact" variant="secondary" onClick={() => onOpenMaps(order)}>
            {language === "th" ? "เปิดแผนที่" : "Open map"}
          </Button>
          <div className="col-span-2">
            <Button
              type="button"
              fullWidth
              size="compact"
              variant="secondary"
              onClick={() => onPickPin(order.id)}
              disabled={resolvingLocationOrderId === order.id}
            >
              {resolvingLocationOrderId === order.id
                ? language === "th"
                  ? "กำลังค้นหาที่อยู่..."
                  : "Looking up address..."
                : t.pickPinOnMap}
            </Button>
          </div>
        </div>
      </div>

      {nextStatus && nextActionLabel ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3.5">
          <p className="mb-2 text-sm text-emerald-900">
            {language === "th"
              ? `ขั้นตอนถัดไป: ${statusLabels[order.status]} → ${statusLabels[nextStatus]}`
              : `Next step: ${statusLabels[order.status]} → ${statusLabels[nextStatus]}`}
          </p>
          <Button
            type="button"
            fullWidth
            variant="success"
            disabled={isSaving}
            onClick={() => onAdvanceStatus(order.id, nextStatus)}
          >
            {isSaving ? (
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
            ) : null}
            {nextActionLabel}
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
        <Select
          label={language === "th" ? "เปลี่ยนสถานะด้วยตนเอง" : "Change status manually"}
          value={order.status}
          disabled={isSaving}
          options={statuses.map((status) => ({ value: status, label: statusLabels[status] }))}
          onChange={(event) => {
            const next = event.target.value as OrderStatus;
            if (next === order.status) {
              return;
            }
            onStatusChange(order.id, next);
          }}
        />
        {isSaving ? (
          <p className="mt-1 text-xs text-slate-500">
            {language === "th" ? "กำลังบันทึกสถานะ..." : "Saving status..."}
          </p>
        ) : null}
      </div>

      {order.status !== "completed" && order.status !== "cancelled" ? (
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3.5">
          <label className="flex items-center gap-2 text-sm text-red-950">
            <input
              type="checkbox"
              checked={restoreMap[order.id] ?? true}
              onChange={(event) => onRestoreMapChange(order.id, event.target.checked)}
            />
            {t.restoreStockOnCancel}
          </label>
          <Button
            type="button"
            fullWidth
            size="compact"
            variant="danger"
            onClick={() => onCancel(order.id, restoreMap[order.id] ?? true)}
          >
            {t.cancelOrderLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
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
  const [searchParams, setSearchParams] = useSearchParams();
  const focusOrderId = searchParams.get("order");
  const handledFocusOrderIdRef = useRef<string | null>(null);
  const [restoreMap, setRestoreMap] = useState<Record<string, boolean>>({});
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus>("new");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "bank_transfer">("all");
  const [dateRange, setDateRange] = useState<"all" | "day" | "week" | "month">("all");
  const [pickingOrderId, setPickingOrderId] = useState<string | null>(null);
  const [resolvingLocationOrderId, setResolvingLocationOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusOrderId || handledFocusOrderIdRef.current === focusOrderId) {
      return;
    }
    const order = orders.find((entry) => entry.id === focusOrderId);
    if (!order) {
      return;
    }

    handledFocusOrderIdRef.current = focusOrderId;
    setStatusFilter(order.status);
    setSelectedOrderId(order.id);
    setSearch("");
    setDateRange("all");
    setPaymentFilter("all");

    const timeoutId = window.setTimeout(() => {
      document.getElementById(`admin-order-${order.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("order");
          return next;
        },
        { replace: true },
      );
      handledFocusOrderIdRef.current = null;
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [focusOrderId, orders, setSearchParams]);

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
      const dateMatch =
        rangeStart === null ? true : (createdDate ?? new Date()) >= rangeStart;
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
    const currentOrder = orders.find((order) => order.id === orderId);
    if (currentOrder?.status === status) {
      return;
    }
    setSavingStatusId(orderId);
    try {
      await setOrderStatus(orderId, status);
      const statusLabel = statusLabels[status];
      onToast(
        language === "th" ? `อัปเดตเป็น ${statusLabel} แล้ว` : `Status updated to ${statusLabel}.`,
        "success",
      );
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
    setResolvingLocationOrderId(orderId);
    try {
      const address = await reverseGeocodeAddress(location.lat, location.lng);
      await updateOrderLocation(orderId, location, address ?? undefined);
      onToast(
        address
          ? language === "th"
            ? "อัปเดตพิกัดและสถานที่จัดส่งแล้ว"
            : "Delivery pin and location updated."
          : t.toastLocationUpdated,
        "success",
      );
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setResolvingLocationOrderId(null);
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

  const handleToggleOrderDetails = (orderId: string, element: HTMLElement): void => {
    const isClosing = selectedOrderId === orderId;
    setSelectedOrderId(isClosing ? null : orderId);
    if (!isClosing) {
      window.requestAnimationFrame(() => {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
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
          const isExpanded = selectedOrderId === order.id;
          return (
            <article
              key={order.id}
              id={`admin-order-${order.id}`}
              className={`scroll-mt-4 rounded-xl border bg-white p-4 shadow-sm ${
                isExpanded ? "border-brand-red/40 ring-1 ring-brand-red/20" : "border-brand-gold/30"
              }`}
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={(event) => handleToggleOrderDetails(order.id, event.currentTarget.closest("article") ?? event.currentTarget)}
                className="block w-full text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div>
                      <OrderFieldLabel>{language === "th" ? "ออเดอร์" : "Order"}</OrderFieldLabel>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold text-brand-redDark">{order.orderRef}</p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClass(order.status)}`}
                        >
                          {statusLabels[order.status]}
                        </span>
                        {order.customer.notes ? (
                          <span className="rounded-full bg-brand-cream px-2.5 py-0.5 text-xs font-medium text-brand-redDark">
                            {language === "th" ? "มีโน้ต" : "Notes"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <OrderFieldLabel>{language === "th" ? "ลูกค้า" : "Customer"}</OrderFieldLabel>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">{order.customer.name}</p>
                    </div>
                    <div>
                      <OrderFieldLabel>{language === "th" ? "เบอร์โทร" : "Phone"}</OrderFieldLabel>
                      <p className="mt-0.5 text-sm text-slate-700">{order.customer.phone}</p>
                    </div>
                    <div>
                      <OrderFieldLabel>{language === "th" ? "ที่อยู่จัดส่ง" : "Address"}</OrderFieldLabel>
                      <p
                        className={`mt-0.5 text-sm leading-relaxed text-slate-700 ${
                          isExpanded ? "whitespace-pre-wrap break-words" : "truncate"
                        }`}
                      >
                        {order.customer.deliveryLocation}
                      </p>
                    </div>
                    {isExpanded && order.customer.notes ? (
                      <div>
                        <OrderFieldLabel>{language === "th" ? "โน้ต" : "Note"}</OrderFieldLabel>
                        <p className="mt-0.5 rounded-lg border border-brand-gold/30 bg-brand-cream/50 p-2.5 text-sm leading-relaxed text-slate-700">
                          {order.customer.notes}
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <OrderFieldLabel>{language === "th" ? "สรุปรายการ" : "Order summary"}</OrderFieldLabel>
                      <p className={`mt-0.5 text-sm leading-relaxed text-slate-700 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {getOrderItemSummary(order, language)}
                      </p>
                    </div>
                    <div>
                      <OrderFieldLabel>{language === "th" ? "การชำระเงิน" : "Payment"}</OrderFieldLabel>
                      <p className="mt-0.5 text-sm text-slate-700">
                        {order.paymentMethod === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-brand-redDark">{formatTHB(order.calculated.total)} THB</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(order.createdAt)}</p>
                    <p className="mt-2 text-xs font-semibold text-brand-gold">
                      {isExpanded
                        ? language === "th"
                          ? "ย่อรายละเอียด"
                          : "Hide details"
                        : language === "th"
                          ? "ดูรายละเอียด"
                          : "View details"}
                    </p>
                  </div>
                </div>
              </button>
              {isExpanded ? (
                <OrderDetailExpand
                  order={order}
                  language={language}
                  t={t}
                  statusLabels={statusLabels}
                  statuses={statuses}
                  nextStatus={nextStatus}
                  nextActionLabel={nextActionLabel}
                  savingStatusId={savingStatusId}
                  restoreMap={restoreMap}
                  resolvingLocationOrderId={resolvingLocationOrderId}
                  onAdvanceStatus={(orderId, status) => {
                    void handleOrderStatusChange(orderId, status);
                  }}
                  onStatusChange={(orderId, status) => {
                    void handleOrderStatusChange(orderId, status);
                  }}
                  onCopy={(value, label) => {
                    void handleCopy(value, label);
                  }}
                  onOpenMaps={openOrderInMaps}
                  onCancel={(orderId, restoreStock) => {
                    void handleCancelOrder(orderId, restoreStock);
                  }}
                  onRestoreMapChange={(orderId, restoreStock) => {
                    setRestoreMap((prev) => ({
                      ...prev,
                      [orderId]: restoreStock,
                    }));
                  }}
                  onPickPin={setPickingOrderId}
                />
              ) : null}
              {!isExpanded && nextStatus && nextActionLabel ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    fullWidth
                    size="compact"
                    variant="success"
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
