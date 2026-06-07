import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, OrderStatus, PrepRecipeDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { toDateOrNull } from "../../utils/dates";
import { formatTHB } from "../../utils/money";
import { subscribePrepRecipes } from "../ordering/orderService";
import { getPackagingStock } from "../ordering/stockUtils";
import { updateOrderingStatus } from "./adminService";
import { getAdminErrorMessage } from "./adminToastErrors";
import {
  calculateShoppingList,
  formatShoppingListQuantity,
  getShoppingListDetail,
  getShoppingListLabel,
  getShoppingOrderCount,
  getShoppingOrdersForScope,
  getShoppingScopeDescription,
  getTodayShoppingOrders,
  readShoppingListScope,
  writeShoppingListScope,
  type ShoppingListScope,
} from "./shoppingList";

interface TodayPanelProps {
  language: Language;
  publicOrderingEnabled: boolean;
  settings: MainSettingsDoc;
  stock: StockDoc;
  products: ProductDoc[];
  orders: Array<OrderDoc & { id: string }>;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
  onNavigate: (section: "orders" | "stock" | "setup") => void;
  onGoToOrders: () => void;
  onGoToOrder: (orderId: string) => void;
  onOpenPrepTools: () => void;
}

function getDeliveryMessage(settings: MainSettingsDoc, language: Language): string {
  const deliveryMessage = settings.deliveryMessage;
  if (deliveryMessage.template === "custom") {
    const customMessage = language === "th" ? deliveryMessage.customMessageTh : deliveryMessage.customMessageEn;
    return customMessage?.trim() || "-";
  }
  if (deliveryMessage.template === "starts_after") {
    return language === "th"
      ? `เริ่มจัดส่งหลัง ${deliveryMessage.startTime ?? "-"}`
      : `Delivery starts after ${deliveryMessage.startTime ?? "-"}`;
  }
  if (deliveryMessage.template === "varies") {
    return language === "th"
      ? "เวลาจัดส่งขึ้นอยู่กับเส้นทางและจำนวนออเดอร์"
      : "Delivery time varies depending on route and demand";
  }
  return language === "th"
    ? `${deliveryMessage.startTime ?? "-"}-${deliveryMessage.endTime ?? "-"}`
    : `${deliveryMessage.startTime ?? "-"}-${deliveryMessage.endTime ?? "-"}`;
}

function getItemSummary(order: OrderDoc & { id: string }, language: Language): string {
  const items = order.itemSnapshot
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity} ${language === "th" ? item.thaiLabel : item.label}`);
  return items.slice(0, 2).join(", ") + (items.length > 2 ? "..." : "");
}

function getStatusLabel(status: OrderStatus, t: Translation): string {
  const labels: Record<OrderStatus, string> = {
    new: t.statusNew,
    confirmed: t.statusConfirmed,
    preparing: t.statusPreparing,
    out_for_delivery: t.statusOutForDelivery,
    completed: t.statusCompleted,
    cancelled: t.statusCancelled,
  };
  return labels[status];
}

function getOrderCreatedTime(order: OrderDoc & { id: string }): number {
  const createdAt = toDateOrNull(order.createdAt);
  return createdAt?.getTime() ?? 0;
}

function MetricValue({
  value,
  unit,
  tone = "default",
}: {
  value: string | number;
  unit?: string;
  tone?: "default" | "stock";
}): JSX.Element {
  const valueClass = tone === "stock" ? "text-emerald-700" : "text-brand-redDark";
  return (
    <p className={`mt-1 text-2xl font-bold ${valueClass}`}>
      {value}
      {unit ? <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span> : null}
    </p>
  );
}

function PackagingLeftCard({
  packagingStock,
  language,
}: {
  packagingStock: ReturnType<typeof getPackagingStock>;
  language: Language;
}): JSX.Element {
  return (
    <Card title={language === "th" ? "บรรจุภัณฑ์คงเหลือ" : "Packaging left"}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-brand-gold/30 bg-white p-2">
          <p className="text-[11px] text-slate-500">{language === "th" ? "ชุดใหญ่" : "Regular"}</p>
          <p className="mt-1 text-xl font-bold text-brand-redDark">{packagingStock.regularPacks}</p>
        </div>
        <div className="rounded-lg border border-brand-gold/30 bg-white p-2">
          <p className="text-[11px] text-slate-500">{language === "th" ? "ชุดเล็ก" : "Small"}</p>
          <p className="mt-1 text-xl font-bold text-brand-redDark">{packagingStock.smallPacks}</p>
        </div>
        <div className="rounded-lg border border-brand-gold/30 bg-white p-2">
          <p className="text-[11px] text-slate-500">{language === "th" ? "น้ำจิ้ม" : "Sauce cups"}</p>
          <p className="mt-1 text-xl font-bold text-brand-redDark">{packagingStock.sauceCups}</p>
        </div>
      </div>
    </Card>
  );
}

export function TodayPanel({
  language,
  publicOrderingEnabled,
  settings,
  stock,
  products,
  orders,
  t,
  onToast,
  onNavigate,
  onGoToOrders,
  onGoToOrder,
  onOpenPrepTools,
}: TodayPanelProps): JSX.Element {
  const [orderingAction, setOrderingAction] = useState<"open" | "close" | null>(null);
  const [recipes, setRecipes] = useState<PrepRecipeDoc[]>([]);
  const [shoppingListScope, setShoppingListScope] = useState<ShoppingListScope>(readShoppingListScope);
  const packagingStock = getPackagingStock(stock);
  const todayOrders = useMemo(() => getTodayShoppingOrders(orders), [orders]);
  const validTodayOrders = useMemo(
    () => todayOrders.filter((order) => order.status !== "cancelled"),
    [todayOrders],
  );
  const revenue = validTodayOrders.reduce((sum, order) => sum + order.calculated.total, 0);
  const activeOrders = useMemo(
    () =>
      todayOrders
        .filter((order) => order.status !== "completed" && order.status !== "cancelled")
        .sort((left, right) => getOrderCreatedTime(right) - getOrderCreatedTime(left)),
    [todayOrders],
  );
  const attentionOrders = activeOrders.slice(0, 5);
  const sharedHoiProducts = products.filter((product) => product.active && product.stockType === "shared_hoi");
  const regularProduct = sharedHoiProducts.find((product) => product.id === "regular") ?? sharedHoiProducts[0];
  const smallProduct =
    sharedHoiProducts.find((product) => product.id === "small") ??
    sharedHoiProducts.find((product) => product.id !== regularProduct?.id);
  const regularAvailable =
    regularProduct && regularProduct.deductionGrams > 0
      ? Math.floor(stock.availableHoiGrams / regularProduct.deductionGrams)
      : 0;
  const smallAvailable =
    smallProduct && smallProduct.deductionGrams > 0
      ? Math.floor(stock.availableHoiGrams / smallProduct.deductionGrams)
      : 0;
  const shoppingListOrders = useMemo(
    () => getShoppingOrdersForScope(orders, shoppingListScope),
    [orders, shoppingListScope],
  );
  const shoppingList = useMemo(
    () => calculateShoppingList(shoppingListOrders, recipes),
    [recipes, shoppingListOrders],
  );
  const shoppingOrderCount = getShoppingOrderCount(shoppingListOrders);
  const hoiAvailableKg = stock.availableHoiGrams / 1000;

  useEffect(() => {
    writeShoppingListScope(shoppingListScope);
  }, [shoppingListScope]);

  useEffect(() => {
    const unsubscribe = subscribePrepRecipes(setRecipes, (error) => {
      onToast(error.message, "error");
    });
    return () => {
      unsubscribe();
    };
  }, [onToast]);

  const handleOrderingStatus = async (): Promise<void> => {
    const nextOpen = !settings.orderingOpen;
    setOrderingAction(nextOpen ? "open" : "close");
    try {
      await updateOrderingStatus(nextOpen);
      onToast(nextOpen ? t.toastOrderingOpened : t.toastOrderingClosed, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setOrderingAction(null);
    }
  };

  const prepTitle = language === "th" ? "เตรียมของ / รายการซื้อ" : "Prep / shopping list";
  const attentionTitle =
    language === "th"
      ? `ออเดอร์ที่ต้องดู (${activeOrders.length})`
      : `Orders needing attention (${activeOrders.length})`;

  const shoppingScopeDescription = getShoppingScopeDescription(
    shoppingListScope,
    shoppingOrderCount,
    language,
  );

  const prepShoppingListCard = (
    <Card title={prepTitle}>
      <div className="mb-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="compact"
            variant={shoppingListScope === "today" ? "primary" : "secondary"}
            fullWidth
            onClick={() => setShoppingListScope("today")}
          >
            {language === "th" ? "วันนี้" : "Today"}
          </Button>
          <Button
            size="compact"
            variant={shoppingListScope === "open" ? "primary" : "secondary"}
            fullWidth
            onClick={() => setShoppingListScope("open")}
          >
            {language === "th" ? "ออเดอร์ค้าง" : "Open orders"}
          </Button>
        </div>
        <p className="text-xs text-slate-600">{shoppingScopeDescription}</p>
      </div>
      <div className="space-y-2">
        {shoppingList.map((item) => (
          <div
            key={`${item.kind ?? "recipe"}-${item.ingredient}-${item.unit}`}
            className="flex justify-between gap-3 rounded-lg border border-brand-gold/30 bg-white p-2 text-sm"
          >
            <div className="min-w-0">
              <span className="font-medium text-brand-redDark">{getShoppingListLabel(item, language)}</span>
              <p className="text-xs text-slate-500">{getShoppingListDetail(item, language)}</p>
            </div>
            <span className="shrink-0 text-slate-700">
              {formatShoppingListQuantity(item)} {item.unit}
            </span>
          </div>
        ))}
        {shoppingList.length === 0 ? (
          <p className="text-sm text-slate-500">
            {shoppingListScope === "today"
              ? language === "th"
                ? "ยังไม่มีรายการซื้อจากออเดอร์วันนี้"
                : "No prep shopping list from today's orders yet."
              : language === "th"
                ? "ยังไม่มีออเดอร์ค้างที่ต้องเตรียมของ"
                : "No open orders need prep yet."}
          </p>
        ) : null}
      </div>
      <div className="mt-3">
        <Button fullWidth variant="secondary" onClick={onOpenPrepTools}>
          {language === "th" ? "เปิดเครื่องมือเตรียมของ" : "Open prep tools"}
        </Button>
      </div>
    </Card>
  );

  const attentionHint =
    language === "th"
      ? "ออเดอร์วันนี้ที่ยังไม่เสร็จและไม่ถูกยกเลิก (เช่น ใหม่ ยืนยัน เตรียม ออกจัดส่ง) แสดงสูงสุด 5 รายการ"
      : "Today's orders still in progress (new, confirmed, preparing, or out for delivery). Shows up to 5, newest first.";

  const attentionCard = (
    <Card title={attentionTitle}>
      <p className="mb-3 text-xs text-slate-600">{attentionHint}</p>
      <div className="space-y-2">
        {attentionOrders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onGoToOrder(order.id)}
            className="block w-full rounded-lg border border-brand-gold/30 bg-white p-3 text-left transition hover:border-brand-red/40 hover:bg-brand-cream/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-brand-redDark">
                  {order.orderRef} {order.customer.name}
                </p>
                <p className="truncate text-xs text-slate-600">{getItemSummary(order, language)}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand-gold">
                  {getStatusLabel(order.status, t)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-brand-redDark">
                  {formatTHB(order.calculated.total)} THB
                </p>
                <p className="mt-1 text-[10px] font-medium text-brand-gold">
                  {language === "th" ? "เปิดในออเดอร์" : "Open in orders"}
                </p>
              </div>
            </div>
          </button>
        ))}
        {attentionOrders.length === 0 ? (
          <p className="text-sm text-slate-500">
            {language === "th" ? "ยังไม่มีออเดอร์ที่ต้องดูตอนนี้" : "No orders need attention right now."}
          </p>
        ) : null}
      </div>
      <div className="mt-3">
        <Button fullWidth onClick={onGoToOrders}>
          {language === "th" ? "รับออเดอร์ / ดูทั้งหมด" : "Take order / view all"}
        </Button>
      </div>
    </Card>
  );

  if (!publicOrderingEnabled) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-white via-brand-cream to-brand-blush p-4 shadow-[0_14px_34px_-22px_rgba(127,29,29,0.75)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
            {language === "th" ? "งานวันนี้" : "Today's operations"}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-brand-redDark">
            {language === "th" ? "ตัวเลขวันนี้" : "Today's numbers"}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-brand-gold/30 bg-white/90 p-3">
              <p className="text-xs text-slate-500">{t.ordersTodayLabel}</p>
              <MetricValue value={todayOrders.length} />
            </div>
            <div className="rounded-xl border border-brand-gold/30 bg-white/90 p-3">
              <p className="text-xs text-slate-500">{t.revenueTodayLabel}</p>
              <MetricValue value={formatTHB(revenue)} unit="THB" />
            </div>
            <div className="rounded-xl border border-brand-gold/30 bg-white/90 p-3">
              <p className="text-xs text-slate-500">{t.hoiKgRemainingLabel}</p>
              <MetricValue value={hoiAvailableKg.toFixed(1)} unit="kg" tone="stock" />
            </div>
            <div className="rounded-xl border border-brand-gold/30 bg-white/90 p-3">
              <p className="text-xs text-slate-500">{t.openerStockLabel}</p>
              <MetricValue value={stock.openerStock} unit={language === "th" ? "ชิ้น" : "left"} tone="stock" />
            </div>
          </div>
        </section>

        <PackagingLeftCard packagingStock={packagingStock} language={language} />
        {prepShoppingListCard}
        {attentionCard}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-white via-brand-cream to-brand-blush p-4 shadow-[0_14px_34px_-22px_rgba(127,29,29,0.75)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
          {language === "th" ? "รับออเดอร์ลูกค้า" : "Public ordering"}
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-redDark">
              {settings.orderingOpen
                ? language === "th"
                  ? "เปิดรับออเดอร์"
                  : "Ordering is OPEN"
                : language === "th"
                  ? "ปิดรับออเดอร์"
                  : "Ordering is CLOSED"}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {language === "th" ? "จัดส่ง" : "Delivery"}: {getDeliveryMessage(settings, language)}
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${
              settings.orderingOpen ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {settings.orderingOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>
        <div className="mt-4">
          <Button fullWidth onClick={() => void handleOrderingStatus()} disabled={orderingAction !== null}>
            {orderingAction !== null ? (
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
            ) : null}
            {settings.orderingOpen ? t.closeOrdering : t.openOrdering}
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">{t.ordersTodayLabel}</p>
          <MetricValue value={todayOrders.length} />
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t.revenueTodayLabel}</p>
          <MetricValue value={formatTHB(revenue)} unit="THB" />
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t.hoiKgRemainingLabel}</p>
          <MetricValue value={hoiAvailableKg.toFixed(1)} unit="kg" tone="stock" />
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t.openerStockLabel}</p>
          <MetricValue value={stock.openerStock} unit={language === "th" ? "ชิ้น" : "left"} tone="stock" />
        </Card>
      </div>

      <PackagingLeftCard packagingStock={packagingStock} language={language} />
      {prepShoppingListCard}
      {attentionCard}

      <Card title={language === "th" ? "ทางลัด" : "Quick Actions"}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => onNavigate("stock")}>
            {language === "th" ? "อัปเดตสต็อก" : "Update Stock"}
          </Button>
          <Button variant="secondary" onClick={() => onNavigate("setup")}>
            {language === "th" ? "แก้ไขข้อความจัดส่ง" : "Edit Delivery Message"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          {language === "th"
            ? `หอยรวมใช้สต็อกเดียวกัน: ชุดใหญ่ได้สูงสุด ${regularAvailable} / ชุดเล็กได้สูงสุด ${smallAvailable}`
            : `Regular and small share one hoi stock: up to ${regularAvailable} regular or ${smallAvailable} small packs.`}
        </p>
      </Card>
    </div>
  );
}
