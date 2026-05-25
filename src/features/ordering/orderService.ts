import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type {
  MainSettingsDoc,
  OrderDoc,
  OrderStatus,
  PaymentMethod,
  ProductDoc,
  StockDoc,
} from "../../types/firestore";
import type { Language } from "../../i18n";
import type { OrderQuantities } from "../../types/firestore";

export interface SubmitOrderInput {
  customer: {
    name: string;
    phone: string;
    email?: string;
    deliveryLocation: string;
    notes?: string;
  };
  quantities: OrderQuantities;
  paymentMethod: PaymentMethod;
}

export interface SubmitOrderResult {
  orderId: string;
  orderRef: string;
}

const settingsRef = doc(db, "settings", "main");
const stockRef = doc(db, "stock", "today");
const productsCollectionRef = collection(db, "products");

export const subscribeSettings = (
  handler: (settings: MainSettingsDoc | null) => void,
  onError?: (error: Error) => void,
): (() => void) =>
  onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        handler(null);
        return;
      }
      handler(snapshot.data() as MainSettingsDoc);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );

export const subscribeStock = (
  handler: (stock: StockDoc | null) => void,
  onError?: (error: Error) => void,
): (() => void) =>
  onSnapshot(
    stockRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        handler(null);
        return;
      }
      handler(snapshot.data() as StockDoc);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );

export const subscribeProducts = (
  handler: (products: ProductDoc[]) => void,
  onError?: (error: Error) => void,
): (() => void) =>
  onSnapshot(
    query(productsCollectionRef, orderBy("sortOrder", "asc")),
    (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<ProductDoc, "id">),
      }));
      handler(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    },
  );

export const subscribeOrders = (
  handler: (orders: Array<OrderDoc & { id: string }>) => void,
): (() => void) =>
  onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
    handler(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as OrderDoc) })));
  });

function buildDeliverySnapshot(deliveryMessage: MainSettingsDoc["deliveryMessage"]): {
  th: string;
  en: string;
} {
  if (deliveryMessage.template === "estimated_range") {
    return {
      th: `เวลาจัดส่งโดยประมาณวันนี้: ${deliveryMessage.startTime ?? "-"}-${deliveryMessage.endTime ?? "-"}`,
      en: `Estimated delivery today: ${deliveryMessage.startTime ?? "-"}-${deliveryMessage.endTime ?? "-"}`,
    };
  }
  if (deliveryMessage.template === "starts_after") {
    return {
      th: `เริ่มจัดส่งหลัง ${deliveryMessage.startTime ?? "-"} เราจะติดต่อคุณทาง LINE หรือโทรศัพท์`,
      en: `Delivery starts after ${deliveryMessage.startTime ?? "-"}. We will contact you by LINE/phone.`,
    };
  }
  if (deliveryMessage.template === "custom") {
    return {
      th: deliveryMessage.customMessageTh ?? "",
      en: deliveryMessage.customMessageEn ?? "",
    };
  }
  return {
    th: "เวลาจัดส่งโดยประมาณจะกำหนดในแต่ละวัน และอาจเปลี่ยนแปลงตามเส้นทางและจำนวนออเดอร์",
    en: "Estimated delivery time is set daily and may vary depending on route and demand.",
  };
}

function generateOrderRef(): string {
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MH-${random}`;
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  const orderRef = generateOrderRef();
  const productsSnapshot = await getDocs(productsCollectionRef);
  const products: ProductDoc[] = productsSnapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<ProductDoc, "id">),
  }));

  return runTransaction(db, async (transaction) => {
    const [settingsSnap, stockSnap] = await Promise.all([
      transaction.get(settingsRef),
      transaction.get(stockRef),
    ]);

    if (!settingsSnap.exists() || !stockSnap.exists()) {
      throw new Error("Settings or stock not initialized.");
    }

    const settings = settingsSnap.data() as MainSettingsDoc;
    const stock = stockSnap.data() as StockDoc;

    if (!settings.orderingOpen) {
      throw new Error("Ordering is closed.");
    }

    const selectedItems = (Object.entries(input.quantities) as Array<[string, number]>)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = products.find((item) => item.id === productId);
        if (!product || !product.active) {
          throw new Error("INVALID_PRODUCT");
        }
        return { product, quantity };
      });

    const sharedHoiDeducted = selectedItems
      .filter((entry) => entry.product.stockType === "shared_hoi")
      .reduce((sum, entry) => sum + entry.quantity * entry.product.deductionGrams, 0);
    const openerDeducted = selectedItems
      .filter((entry) => entry.product.stockType === "opener")
      .reduce((sum, entry) => sum + entry.quantity, 0);
    const includedSauce = selectedItems.reduce(
      (sum, entry) => sum + entry.quantity * entry.product.includedSauce,
      0,
    );
    const extraSauce = selectedItems
      .filter((entry) => entry.product.category === "sauce" && entry.product.includedSauce === 0)
      .reduce((sum, entry) => sum + entry.quantity, 0);
    const subtotal = selectedItems.reduce(
      (sum, entry) => sum + entry.quantity * entry.product.price,
      0,
    );

    if (sharedHoiDeducted > stock.availableHoiGrams) {
      throw new Error("STOCK_CHANGED");
    }
    if (openerDeducted > stock.openerStock) {
      throw new Error("OPENER_STOCK_CHANGED");
    }
    if (subtotal <= 0) {
      throw new Error("EMPTY_ORDER");
    }

    const orderData: Omit<OrderDoc, "createdAt" | "updatedAt"> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      updatedAt: ReturnType<typeof serverTimestamp>;
    } = {
      orderRef,
      customer: input.customer,
      quantities: input.quantities,
      calculated: {
        hoiGramsDeducted: sharedHoiDeducted,
        includedSauce,
        extraSauce,
        totalSauce: includedSauce + extraSauce,
        subtotal,
        total: subtotal,
      },
      paymentMethod: input.paymentMethod,
      status: "new",
      deliveryMessageSnapshot: buildDeliverySnapshot(settings.deliveryMessage),
      itemSnapshot: selectedItems.map((entry) => ({
        productId: entry.product.id,
        label: entry.product.label,
        thaiLabel: entry.product.thaiLabel,
        price: entry.product.price,
        quantity: entry.quantity,
        lineTotal: entry.quantity * entry.product.price,
        stockType: entry.product.stockType,
        category: entry.product.category,
      })),
      pricingSnapshot: Object.fromEntries(products.map((item) => [item.id, item.price])),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const orderDocRef = doc(collection(db, "orders"));
    transaction.set(orderDocRef, orderData);
    transaction.update(stockRef, {
      availableHoiGrams: stock.availableHoiGrams - sharedHoiDeducted,
      openerStock: stock.openerStock - openerDeducted,
      updatedAt: serverTimestamp(),
    });

    return {
      orderId: orderDocRef.id,
      orderRef,
    };
  });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Order not found");
    }
    transaction.update(orderRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function cancelOrder(orderId: string, restoreStock: boolean): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const [orderSnap, stockSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(stockRef),
    ]);

    if (!orderSnap.exists() || !stockSnap.exists()) {
      throw new Error("Order or stock not found");
    }

    const order = orderSnap.data() as OrderDoc;
    const stock = stockSnap.data() as StockDoc;
    const openerQty = order.itemSnapshot
      .filter((item) => item.stockType === "opener")
      .reduce((sum, item) => sum + item.quantity, 0);
    const stockPatch = restoreStock
      ? {
          availableHoiGrams: stock.availableHoiGrams + order.calculated.hoiGramsDeducted,
          openerStock: stock.openerStock + openerQty,
          updatedAt: serverTimestamp(),
        }
      : null;

    transaction.update(orderRef, {
      status: "cancelled" satisfies OrderStatus,
      stockRestored: restoreStock,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (stockPatch) {
      transaction.update(stockRef, stockPatch);
    }
  });
}

export function getDeliverySnapshotByLanguage(
  deliverySnapshot: { th: string; en: string },
  language: Language,
): string {
  return language === "th" ? deliverySnapshot.th : deliverySnapshot.en;
}
