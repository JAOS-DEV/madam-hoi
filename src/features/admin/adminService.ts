import { signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { adminEmails, auth, db } from "../../lib/firebase";
import type { MainSettingsDoc, OrderStatus } from "../../types/firestore";
import { cancelOrder, updateOrderStatus } from "../ordering/orderService";
import { kgToGrams } from "../ordering/stockUtils";

export function isAllowedAdmin(user: User | null): boolean {
  if (!user?.email) {
    return false;
  }
  return adminEmails.includes(user.email.toLowerCase());
}

export async function loginAdmin(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
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
  await updateDoc(doc(db, "stock", "today"), {
    availableHoiGrams: kgToGrams(kg),
    openerStock,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSettingsPatch(
  patch: Partial<MainSettingsDoc>,
): Promise<void> {
  await updateDoc(doc(db, "settings", "main"), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateOrderStatus(orderId, status);
}

export async function cancelOrderByAdmin(orderId: string, restoreStock: boolean): Promise<void> {
  await cancelOrder(orderId, restoreStock);
}
