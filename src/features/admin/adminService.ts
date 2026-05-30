import { signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { adminEmails, auth, db } from "../../lib/firebase";
import type { MainSettingsDoc, OrderStatus, PrepRecipeDoc } from "../../types/firestore";
import { sanitizeForFirestore } from "../../utils/firestore";
import { cancelOrder, updateOrderStatus } from "../ordering/orderService";
import { kgToGrams } from "../ordering/stockUtils";

export function isAllowedAdmin(user: User | null): boolean {
  if (!user?.email) {
    return false;
  }
  return adminEmails.includes(user.email.toLowerCase());
}

export async function loginAdmin(email: string, password: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  await signInWithEmailAndPassword(auth, normalizedEmail, password);
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
}

export async function updateOrderingStatus(orderingOpen: boolean): Promise<void> {
  await updateDoc(doc(db, "settings", "main"), {
    orderingOpen,
    updatedAt: serverTimestamp(),
  });
}

export async function updateStock(kg: number, openerStock: number): Promise<void> {
  const availableHoiGrams = kgToGrams(kg);
  if (!Number.isFinite(availableHoiGrams) || !Number.isFinite(openerStock)) {
    throw new Error("Invalid stock values.");
  }

  await updateDoc(doc(db, "stock", "today"), {
    availableHoiGrams,
    openerStock,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSettingsPatch(
  patch: Partial<MainSettingsDoc>,
): Promise<void> {
  const sanitizedPatch = sanitizeForFirestore(patch);
  await updateDoc(doc(db, "settings", "main"), {
    ...sanitizedPatch,
    updatedAt: serverTimestamp(),
  });
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateOrderStatus(orderId, status);
}

export async function cancelOrderByAdmin(orderId: string, restoreStock: boolean): Promise<void> {
  await cancelOrder(orderId, restoreStock);
}

export async function archiveOrdersByStatuses(statuses: OrderStatus[]): Promise<number> {
  const ordersQuery = query(collection(db, "orders"), where("status", "in", statuses));
  const snapshot = await getDocs(ordersQuery);
  const targets = snapshot.docs.filter((item) => item.data().archivedAt === undefined);

  if (targets.length === 0) {
    return 0;
  }

  const batch = writeBatch(db);
  targets.forEach((item) => {
    batch.update(item.ref, {
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return targets.length;
}

export async function archiveAllActiveOrders(): Promise<number> {
  const snapshot = await getDocs(collection(db, "orders"));
  const targets = snapshot.docs.filter((item) => item.data().archivedAt === undefined);

  if (targets.length === 0) {
    return 0;
  }

  const batch = writeBatch(db);
  targets.forEach((item) => {
    batch.update(item.ref, {
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return targets.length;
}

export async function updateOrderLocation(
  orderId: string,
  location: { lat: number; lng: number },
): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), {
    "customer.location": location,
    updatedAt: serverTimestamp(),
  });
}

export async function upsertPrepRecipe(recipe: Omit<PrepRecipeDoc, "updatedAt">): Promise<void> {
  const { id, ...payload } = recipe;
  await setDoc(
    doc(db, "prepRecipes", id),
    {
      ...sanitizeForFirestore(payload),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function seedDefaultPrepRecipes(): Promise<void> {
  await Promise.all([
    upsertPrepRecipe({
      id: "sauce",
      target: "Sauce",
      calcMode: "per_batch",
      servingsSource: "total_sauce",
      servingsPerBatch: 20,
      ingredients: [
        { name: "Lime", unit: "pcs", amount: 20 },
        { name: "Chili", unit: "pcs", amount: 30 },
      ],
    }),
    upsertPrepRecipe({
      id: "salad",
      target: "Salad",
      calcMode: "per_item",
      servingsSource: "orders_count",
      ingredients: [
        { name: "Cucumber", unit: "pcs", amount: 0.3 },
        { name: "Onion", unit: "pcs", amount: 0.2 },
      ],
    }),
  ]);
}

const pattayaStops = [
  { name: "The Panora Pattaya", lat: 12.8712, lng: 100.9025 },
  { name: "Terminal 21 Pattaya", lat: 12.9569, lng: 100.8902 },
  { name: "Central Festival Pattaya Beach", lat: 12.9347, lng: 100.8835 },
  { name: "Walking Street Pattaya", lat: 12.9274, lng: 100.8734 },
  { name: "Bali Hai Pier Pattaya", lat: 12.9181, lng: 100.8713 },
  { name: "Jomtien Beach Night Market", lat: 12.8897, lng: 100.8838 },
  { name: "Pattaya Floating Market", lat: 12.8762, lng: 100.9122 },
  { name: "Sanctuary of Truth", lat: 12.9732, lng: 100.8894 },
  { name: "Naklua Fish Market", lat: 12.9649, lng: 100.8872 },
  { name: "Thepprasit Night Market", lat: 12.9072, lng: 100.8908 },
  { name: "Big C South Pattaya", lat: 12.9154, lng: 100.8846 },
  { name: "Pattaya Park Night Plaza", lat: 12.9037, lng: 100.8691 },
  { name: "Pratumnak Hill Viewpoint", lat: 12.9142, lng: 100.8608 },
  { name: "Underwater World Pattaya", lat: 12.9035, lng: 100.9011 },
  { name: "Art in Paradise Pattaya", lat: 12.9478, lng: 100.8891 },
  { name: "Mini Siam Pattaya", lat: 12.9617, lng: 100.9165 },
  { name: "The Avenue Pattaya", lat: 12.9316, lng: 100.8807 },
  { name: "Pattaya City Hospital", lat: 12.9301, lng: 100.8899 },
  { name: "Harbor Pattaya", lat: 12.944, lng: 100.8977 },
  { name: "Royal Garden Plaza", lat: 12.9301, lng: 100.8778 },
];

function buildSeedOrder(stop: { name: string; lat: number; lng: number }, index: number) {
  const regularQty = index % 3 === 0 ? 2 : 1;
  const smallQty = index % 2;
  const sauceQty = index % 4;
  const openerQty = index % 5 === 0 ? 1 : 0;
  const quantities = {
    regular: regularQty,
    small: smallQty,
    extra_sauce: sauceQty,
    opener: openerQty,
  };
  const itemSnapshot = [
    {
      productId: "regular",
      label: "Regular Hoi Kraeng",
      thaiLabel: "หอยแครงชุดใหญ่",
      price: 200,
      quantity: regularQty,
      lineTotal: regularQty * 200,
      stockType: "shared_hoi",
      category: "hoi",
    },
    {
      productId: "small",
      label: "Small Hoi Kraeng",
      thaiLabel: "หอยแครงชุดเล็ก",
      price: 150,
      quantity: smallQty,
      lineTotal: smallQty * 150,
      stockType: "shared_hoi",
      category: "hoi",
    },
    {
      productId: "extra_sauce",
      label: "Extra Sauce",
      thaiLabel: "น้ำจิ้มเพิ่ม",
      price: 20,
      quantity: sauceQty,
      lineTotal: sauceQty * 20,
      stockType: "none",
      category: "sauce",
    },
    {
      productId: "opener",
      label: "Hoi Opener",
      thaiLabel: "ที่แกะหอย",
      price: 80,
      quantity: openerQty,
      lineTotal: openerQty * 80,
      stockType: "opener",
      category: "tool",
    },
  ].filter((item) => item.quantity > 0);
  const total = itemSnapshot.reduce((sum, item) => sum + item.lineTotal, 0);
  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - (index % 7));
  createdDate.setHours(13 + (index % 6), 10, 0, 0);
  const status =
    index === 2 || index === 7 || index === 14
      ? "cancelled"
      : index === 4 || index === 9 || index === 19
        ? "completed"
        : "new";

  return {
    orderRef: `MH-T${String(index + 1).padStart(3, "0")}`,
    customer: {
      name: `Test Customer ${index + 1}`,
      phone: `08${String(10000000 + index).slice(0, 8)}`,
      deliveryLocation: stop.name,
      notes: "Seed dummy order for routing test",
      location: { lat: stop.lat, lng: stop.lng },
    },
    quantities,
    calculated: {
      hoiGramsDeducted: regularQty * 700 + smallQty * 500,
      includedSauce: regularQty + smallQty,
      extraSauce: sauceQty,
      totalSauce: regularQty + smallQty + sauceQty,
      subtotal: total,
      total,
    },
    paymentMethod: index % 2 === 0 ? "cash" : "bank_transfer",
    orderSource: "admin_manual",
    customerId: `seed-customer-${index + 1}`,
    status,
    deliveryMessageSnapshot: {
      th: "เวลาจัดส่งโดยประมาณวันนี้: 19:00-22:00",
      en: "Estimated delivery today: 19:00-22:00",
    },
    itemSnapshot,
    pricingSnapshot: {
      regular: 200,
      small: 150,
      extra_sauce: 20,
      opener: 80,
    },
    createdAt: Timestamp.fromDate(createdDate),
    updatedAt: Timestamp.fromDate(createdDate),
    ...(status === "cancelled" ? { cancelledAt: Timestamp.fromDate(createdDate), stockRestored: false } : {}),
  };
}

export async function seedDummyRoutingOrders(): Promise<void> {
  await Promise.all(
    pattayaStops.map((stop, index) =>
      setDoc(
        doc(db, "orders", `seed-routing-${String(index + 1).padStart(3, "0")}`),
        buildSeedOrder(stop, index),
      ),
    ),
  );
}

export async function clearDummyRoutingOrders(): Promise<void> {
  await Promise.all(
    pattayaStops.map((_, index) =>
      deleteDoc(doc(db, "orders", `seed-routing-${String(index + 1).padStart(3, "0")}`)),
    ),
  );
}
