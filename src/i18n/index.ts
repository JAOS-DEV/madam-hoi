import { en } from "./en";
import { th } from "./th";

export type Language = "th" | "en";

export interface Translation {
  brandName: string;
  brandTagline: string;
  brandSubline: string;
  deliveryEstimatePrefix: string;
  orderFinalWarning: string;
  paymentOnDelivery: string;
  cashOnDelivery: string;
  bankTransferOnDelivery: string;
  name: string;
  phone: string;
  deliveryLocation: string;
  notes: string;
  confirmOrder: string;
  soldOut: string;
  orderingClosed: string;
  orderReceived: string;
  regularHoi: string;
  smallHoi: string;
  extraSauce: string;
  hoiOpener: string;
  quantity: string;
  total: string;
  paymentMethod: string;
  required: string;
  invalidPhone: string;
  email: string;
  optional: string;
  languageToggle: string;
  announcement: string;
  todayStock: string;
  stockAutoUpdates: string;
  canStillAdd: string;
  regular: string;
  small: string;
  includedSauce: string;
  totalSauce: string;
  orderSummary: string;
  orderReference: string;
  contactForChanges: string;
  invalidStockChange: string;
  openOrdering: string;
  closeOrdering: string;
  adminLogin: string;
  adminEmail: string;
  adminPassword: string;
  signIn: string;
  signOut: string;
}

export const translations: Record<Language, Translation> = {
  th,
  en,
};
