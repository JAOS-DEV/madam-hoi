export interface DeliveryMessage {
  template: "estimated_range" | "starts_after" | "varies" | "custom";
  startTime?: string;
  endTime?: string;
  customMessageTh?: string;
  customMessageEn?: string;
}

export interface BankTransferSettings {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  noteTh: string;
  noteEn: string;
}

export interface ProductSetting {
  label: string;
  thaiLabel: string;
  price: number;
  active: boolean;
}

export interface HoiProductSetting extends ProductSetting {
  sizeLabel: string;
  deductionGrams: number;
  includedSauce: number;
}

export interface ProductSettings {
  regular: HoiProductSetting;
  small: HoiProductSetting;
  extraSauce: ProductSetting;
  opener: ProductSetting;
}

export interface MainSettingsDoc {
  orderingOpen: boolean;
  announcement: string;
  phoneNumber: string;
  lineUrl?: string;
  deliveryMessage: DeliveryMessage;
  bankTransfer: BankTransferSettings;
  productSettings: ProductSettings;
}

export interface StockDoc {
  availableHoiGrams: number;
  openerStock: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email?: string;
  deliveryLocation: string;
  notes?: string;
}

export interface OrderQuantities {
  regular: number;
  small: number;
  extraSauce: number;
  opener: number;
}

export interface OrderCalculated {
  hoiGramsDeducted: number;
  includedSauce: number;
  extraSauce: number;
  totalSauce: number;
  subtotal: number;
  total: number;
}

export type PaymentMethod = "cash" | "bank_transfer";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export interface OrderDoc {
  orderRef: string;
  customer: OrderCustomer;
  quantities: OrderQuantities;
  calculated: OrderCalculated;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  deliveryMessageSnapshot: {
    th: string;
    en: string;
  };
  pricingSnapshot: {
    regularPrice: number;
    smallPrice: number;
    extraSaucePrice: number;
    openerPrice: number;
  };
  createdAt: unknown;
  updatedAt: unknown;
  cancelledAt?: unknown;
  stockRestored?: boolean;
}
