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

export type ProductStockType = "shared_hoi" | "opener" | "none";
export type ProductCategory = "hoi" | "sauce" | "tool" | "other";

export interface ProductDoc {
  id: string;
  label: string;
  thaiLabel: string;
  price: number;
  active: boolean;
  stockType: ProductStockType;
  deductionGrams: number;
  includedSauce: number;
  category: ProductCategory;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  sortOrder: number;
}

export interface MainSettingsDoc {
  orderingOpen: boolean;
  announcement: string;
  phoneNumber: string;
  lineUrl?: string;
  dispatchPoint?: {
    address: string;
    lat?: number;
    lng?: number;
  };
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
  location?: {
    lat: number;
    lng: number;
  };
}

export type OrderQuantities = Record<string, number>;

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
  itemSnapshot: Array<{
    productId: string;
    label: string;
    thaiLabel: string;
    price: number;
    quantity: number;
    lineTotal: number;
    stockType: ProductStockType;
    category: ProductCategory;
  }>;
  pricingSnapshot: Record<string, number>;
  createdAt: unknown;
  updatedAt: unknown;
  cancelledAt?: unknown;
  stockRestored?: boolean;
  archivedAt?: unknown;
}
