import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type { MainSettingsDoc, OrderDoc, PrepRecipeDoc, ProductDoc, StockDoc } from "../../types/firestore";
import { toDateOrNull } from "../../utils/dates";
import { formatTHB } from "../../utils/money";
import { subscribePrepRecipes } from "../ordering/orderService";
import { getPackagingStock } from "../ordering/stockUtils";
import { updateOrderingStatus } from "./adminService";
import { getAdminErrorMessage } from "./adminToastErrors";
import { calculateShoppingList } from "./shoppingList";

interface TodayPanelProps {
  language: Language;
  settings: MainSettingsDoc;
  stock: StockDoc;
  products: ProductDoc[];
  orders: Array<OrderDoc & { id: string }>;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
  onNavigate: (section: "orders" | "stock" | "setup") => void;
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

function getTodayOrders(orders: Array<OrderDoc & { id: string }>): Array<OrderDoc & { id: string }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return orders.filter((order) => {
    const createdAt = toDateOrNull(order.createdAt);
    return createdAt !== null && createdAt >= start && order.archivedAt === undefined;
  });
}

function getItemSummary(order: OrderDoc & { id: string }, language: Language): string {
  const items = order.itemSnapshot
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity} ${language === "th" ? item.thaiLabel : item.label}`);
  return items.slice(0, 2).join(", ") + (items.length > 2 ? "..." : "");
}

export function TodayPanel({
  language,
  settings,
  stock,
  products,
  orders,
  t,
  onToast,
  onNavigate,
  onOpenPrepTools,
}: TodayPanelProps): JSX.Element {
  const [orderingAction, setOrderingAction] = useState<"open" | "close" | null>(null);
  const [recipes, setRecipes] = useState<PrepRecipeDoc[]>([]);
  const packagingStock = getPackagingStock(stock);
  const todayOrders = useMemo(() => getTodayOrders(orders), [orders]);
  const validTodayOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const revenue = validTodayOrders.reduce((sum, order) => sum + order.calculated.total, 0);
  const activeOrders = todayOrders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  );
  const newestOrders = activeOrders.slice(0, 3);
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
  const shoppingList = useMemo(() => calculateShoppingList(todayOrders, recipes), [recipes, todayOrders]);
  const shoppingListPreview = shoppingList.slice(0, 4);

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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-white via-brand-cream to-brand-blush p-4 shadow-[0_14px_34px_-22px_rgba(127,29,29,0.75)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-gold">
          {language === "th" ? "งานวันนี้" : "Today's Operations"}
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-redDark">
              {settings.orderingOpen ? (language === "th" ? "เปิดรับออเดอร์" : "Ordering is OPEN") : language === "th" ? "ปิดรับออเดอร์" : "Ordering is CLOSED"}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {language === "th" ? "จัดส่ง" : "Delivery"}: {getDeliveryMessage(settings, language)}
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-semibold ${
              settings.orderingOpen
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-100 text-slate-700"
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
          <p className="mt-1 text-2xl font-bold text-brand-redDark">{todayOrders.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t.revenueTodayLabel}</p>
          <p className="mt-1 text-2xl font-bold text-brand-redDark">{formatTHB(revenue)}</p>
          <p className="text-xs text-slate-500">THB</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t.hoiKgRemainingLabel}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{(stock.availableHoiGrams / 1000).toFixed(1)}</p>
          <p className="text-xs text-slate-500">kg</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{t.openerStockLabel}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stock.openerStock}</p>
          <p className="text-xs text-slate-500">{language === "th" ? "ชิ้น" : "left"}</p>
        </Card>
      </div>

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

      <Card title={language === "th" ? "เตรียมของ / รายการซื้อ" : "Prep / Shopping List"}>
        <div className="space-y-2">
          {shoppingListPreview.map((item) => (
            <div key={`${item.ingredient}-${item.unit}`} className="flex justify-between gap-3 rounded-lg border border-brand-gold/30 bg-white p-2 text-sm">
              <span className="font-medium text-brand-redDark">{item.ingredient}</span>
              <span className="text-slate-700">
                {item.quantity.toFixed(2)} {item.unit}
              </span>
            </div>
          ))}
          {shoppingListPreview.length === 0 ? (
            <p className="text-sm text-slate-500">
              {language === "th"
                ? "ยังไม่มีรายการซื้อจากออเดอร์วันนี้"
                : "No prep shopping list from today's orders yet."}
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <Button fullWidth variant="secondary" onClick={onOpenPrepTools}>
            {language === "th" ? "เปิดเครื่องมือเตรียมของ" : "Open prep tools"}
          </Button>
        </div>
      </Card>

      <Card title={language === "th" ? "ออเดอร์ใหม่" : "New Orders"}>
        <div className="space-y-2">
          {newestOrders.map((order) => (
            <article key={order.id} className="rounded-lg border border-brand-gold/30 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-redDark">
                    {order.orderRef} {order.customer.name}
                  </p>
                  <p className="truncate text-xs text-slate-600">{getItemSummary(order, language)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-brand-redDark">
                  {formatTHB(order.calculated.total)} THB
                </p>
              </div>
            </article>
          ))}
          {newestOrders.length === 0 ? (
            <p className="text-sm text-slate-500">{language === "th" ? "ยังไม่มีออเดอร์ที่ต้องดูตอนนี้" : "No orders need attention right now."}</p>
          ) : null}
        </div>
        <div className="mt-3">
          <Button fullWidth onClick={() => onNavigate("orders")}>
            {language === "th" ? "ดูออเดอร์ทั้งหมด" : "View all orders"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
