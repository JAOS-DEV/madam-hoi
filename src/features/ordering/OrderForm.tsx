import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { MapPinPicker } from "../../components/ui/MapPinPicker";
import { Select } from "../../components/ui/Select";
import { ToastHost } from "../../components/ui/ToastHost";
import { useToast, type ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type {
  CustomerProfileDoc,
  OrderDoc,
  OrderQuantities,
  OrderSource,
  PaymentMethod,
  ProductDoc,
  StockDoc,
} from "../../types/firestore";
import { reverseGeocodeAddress } from "../../utils/geocoding";
import { gramsToKgLabel } from "./stockUtils";
import { QuantityStepper } from "./QuantityStepper";
import { orderSchema, type OrderSchemaInput } from "./orderSchema";
import { submitOrder } from "./orderService";
import { RegularSpecialPicker } from "./RegularSpecialPicker";
import { OrderSummary } from "./OrderSummary";
import {
  buildQuantitiesWithSpecial,
  canEnableAnotherSpecialSlot,
  countRegularSpecialSlots,
  SPECIAL_EXTRA_HOI_GRAMS,
  SPECIAL_EXTRA_PRICE_THB,
  syncRegularSpecialSlots,
} from "./regularSpecial";

interface OrderFormProps {
  language: Language;
  mode?: "customer" | "admin";
  orderingOpen: boolean;
  stock: StockDoc;
  products: ProductDoc[];
  customers?: CustomerProfileDoc[];
  t: Translation;
  onOrderSuccess: (
    orderId: string,
    orderRef: string,
    paymentMethod: PaymentMethod,
    order: OrderDoc & { id: string },
  ) => void;
  onToast?: (message: string, tone: ToastTone) => void;
}

interface AdminOrderDraft {
  quantities: OrderQuantities;
  regularSpecialSlots?: boolean[];
  /** @deprecated Legacy single checkbox; migrated to one special slot on restore. */
  isRegularSpecial?: boolean;
  values: Partial<OrderSchemaInput>;
}

const createEmptyQuantities = (products: ProductDoc[]): OrderQuantities =>
  Object.fromEntries(products.map((product) => [product.id, 0]));
const ADMIN_ORDER_DRAFT_KEY = "madam-hoi.admin-order-draft";

function readAdminOrderDraft(): AdminOrderDraft | null {
  try {
    const raw = window.sessionStorage.getItem(ADMIN_ORDER_DRAFT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AdminOrderDraft;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAdminOrderDraft(draft: AdminOrderDraft): void {
  try {
    window.sessionStorage.setItem(ADMIN_ORDER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures; the form still works without draft persistence.
  }
}

function clearAdminOrderDraft(): void {
  try {
    window.sessionStorage.removeItem(ADMIN_ORDER_DRAFT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function OrderForm({
  language,
  mode = "customer",
  orderingOpen,
  stock,
  products,
  customers = [],
  t,
  onOrderSuccess,
  onToast,
}: OrderFormProps): JSX.Element {
  const localToast = useToast();
  const notify = (message: string, tone: ToastTone): void => {
    if (onToast) {
      onToast(message, tone);
      return;
    }
    localToast.showToast(message, tone);
  };

  const activeProducts = useMemo(
    () => products.filter((product) => product.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [products],
  );
  const [quantities, setQuantities] = useState<OrderQuantities>(() =>
    createEmptyQuantities(activeProducts),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isResolvingDeliveryAddress, setIsResolvingDeliveryAddress] = useState(false);
  const [regularSpecialSlots, setRegularSpecialSlots] = useState<boolean[]>([]);
  const isAdminMode = mode === "admin";
  const [hasRestoredAdminDraft, setHasRestoredAdminDraft] = useState(false);
  const form = useForm<OrderSchemaInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      deliveryLocation: "",
      notes: "",
      paymentMethod: "cash",
      customerId: "",
      orderSource: isAdminMode ? "admin_manual" : "web",
      locationLat: undefined,
      locationLng: undefined,
    },
  });

  const sourceLabels: Record<OrderSource, string> = {
    web: language === "th" ? "หน้าเว็บลูกค้า" : "Customer web",
    line: "LINE",
    phone: language === "th" ? "โทรศัพท์" : "Phone",
    walk_in: language === "th" ? "หน้าร้าน/รับเอง" : "Walk-in",
    admin_manual: language === "th" ? "แอดมินกรอกเอง" : "Admin manual",
  };

  useEffect(() => {
    setQuantities((prev) => {
      const next = createEmptyQuantities(activeProducts);
      activeProducts.forEach((product) => {
        next[product.id] = prev[product.id] ?? 0;
      });
      return next;
    });
  }, [activeProducts]);

  useEffect(() => {
    if (!isAdminMode || hasRestoredAdminDraft || activeProducts.length === 0) {
      return;
    }
    const draft = readAdminOrderDraft();
    if (draft) {
      const nextQuantities = createEmptyQuantities(activeProducts);
      activeProducts.forEach((product) => {
        nextQuantities[product.id] = draft.quantities[product.id] ?? 0;
      });
      setQuantities(nextQuantities);
      const regularQty = nextQuantities.regular ?? 0;
      if (Array.isArray(draft.regularSpecialSlots)) {
        setRegularSpecialSlots(syncRegularSpecialSlots(draft.regularSpecialSlots, regularQty));
      } else if (draft.isRegularSpecial && regularQty > 0) {
        setRegularSpecialSlots(syncRegularSpecialSlots([true], regularQty));
      } else {
        setRegularSpecialSlots(syncRegularSpecialSlots([], regularQty));
      }
      form.reset({
        name: draft.values.name ?? "",
        phone: draft.values.phone ?? "",
        email: draft.values.email ?? "",
        deliveryLocation: draft.values.deliveryLocation ?? "",
        notes: draft.values.notes ?? "",
        paymentMethod: draft.values.paymentMethod ?? "cash",
        customerId: draft.values.customerId ?? "",
        orderSource: draft.values.orderSource ?? "admin_manual",
        locationLat: draft.values.locationLat,
        locationLng: draft.values.locationLng,
      });
    }
    setHasRestoredAdminDraft(true);
  }, [activeProducts, form, hasRestoredAdminDraft, isAdminMode]);

  const regularQty = quantities.regular ?? 0;
  const specialRegularCount = countRegularSpecialSlots(regularSpecialSlots);

  useEffect(() => {
    setRegularSpecialSlots((prev) => syncRegularSpecialSlots(prev, regularQty));
  }, [regularQty]);

  useEffect(() => {
    form.setValue("orderSource", isAdminMode ? "admin_manual" : "web");
  }, [form, isAdminMode]);

  const summary = useMemo(() => {
    const selected = activeProducts.map((product) => ({
      product,
      qty: quantities[product.id] ?? 0,
    }));
    const hoiGramsDeducted = selected
      .filter((item) => item.product.stockType === "shared_hoi")
      .reduce((sum, item) => sum + item.qty * item.product.deductionGrams, 0);
    const includedSauce = selected.reduce(
      (sum, item) => sum + item.qty * item.product.includedSauce,
      0,
    );
    const extraSauce = selected
      .filter((item) => item.product.category === "sauce" && item.product.includedSauce === 0)
      .reduce((sum, item) => sum + item.qty, 0);
    const baseTotal = selected.reduce((sum, item) => sum + item.qty * item.product.price, 0);
    const total = baseTotal + specialRegularCount * SPECIAL_EXTRA_PRICE_THB;
    return {
      hoiGramsDeducted: hoiGramsDeducted + specialRegularCount * SPECIAL_EXTRA_HOI_GRAMS,
      includedSauce,
      extraSauce,
      totalSauce: includedSauce + extraSauce,
      total,
      subtotal: total,
    };
  }, [activeProducts, quantities, specialRegularCount]);

  const baseHoiGrams = useMemo(() => {
    return activeProducts
      .filter((product) => product.stockType === "shared_hoi")
      .reduce((sum, product) => sum + (quantities[product.id] ?? 0) * product.deductionGrams, 0);
  }, [activeProducts, quantities]);

  const remainingHoiGrams = Math.max(0, stock.availableHoiGrams - summary.hoiGramsDeducted);
  const openerSelected = activeProducts
    .filter((item) => item.stockType === "opener")
    .reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0);
  const remainingOpeners = stock.openerStock - openerSelected;
  const canStillAddByProduct = useMemo(
    () =>
      Object.fromEntries(
        activeProducts.map((product) => {
          if (product.stockType === "shared_hoi") {
            return [product.id, Math.floor(remainingHoiGrams / Math.max(product.deductionGrams, 1))];
          }
          if (product.stockType === "opener") {
            return [product.id, Math.max(0, remainingOpeners)];
          }
          return [product.id, Number.POSITIVE_INFINITY];
        }),
      ),
    [activeProducts, remainingHoiGrams, remainingOpeners],
  );

  const increment = (key: string): void => {
    setQuantities((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  };
  const decrement = (key: string): void => {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) - 1) }));
  };

  const toggleRegularSpecialSlot = (index: number): void => {
    setRegularSpecialSlots((prev) => {
      const synced = syncRegularSpecialSlots(prev, regularQty);
      const enabling = !synced[index];
      if (
        enabling &&
        !canEnableAnotherSpecialSlot(synced, regularQty, baseHoiGrams, stock.availableHoiGrams)
      ) {
        return prev;
      }
      const next = [...synced];
      next[index] = enabling;
      return next;
    });
  };

  const handleMapPinConfirm = async (lat: number, lng: number): Promise<void> => {
    form.setValue("locationLat", lat, { shouldDirty: true, shouldValidate: true });
    form.setValue("locationLng", lng, { shouldDirty: true, shouldValidate: true });
    setIsMapPickerOpen(false);
    setIsResolvingDeliveryAddress(true);
    try {
      const address = await reverseGeocodeAddress(lat, lng);
      if (address) {
        form.setValue("deliveryLocation", address, { shouldDirty: true, shouldValidate: true });
        setIsResolvingDeliveryAddress(false);
        notify(
          language === "th" ? "อัปเดตสถานที่จัดส่งจากพินแล้ว" : "Delivery location filled from pin.",
          "success",
        );
      } else {
        notify(
          language === "th"
            ? "ไม่พบที่อยู่จากพินนี้ กรุณากรอกสถานที่จัดส่งเอง"
            : "No address found for this pin. Please enter the delivery location manually.",
          "error",
        );
      }
    } catch {
      notify(
        language === "th"
          ? "ค้นหาที่อยู่ไม่สำเร็จ กรุณากรอกสถานที่จัดส่งเอง"
          : "Could not look up the address. Please enter the delivery location manually.",
        "error",
      );
    } finally {
      setIsResolvingDeliveryAddress(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (summary.total <= 0) {
      setSubmitError("Please add at least one paid item.");
      notify(
        language === "th" ? "กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ" : "Please add at least one paid item.",
        "error",
      );
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const result = await submitOrder({
        customer: {
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          deliveryLocation: values.deliveryLocation,
          location: {
            lat: values.locationLat,
            lng: values.locationLng,
          },
          notes: values.notes || undefined,
        },
        quantities: buildQuantitiesWithSpecial(quantities, specialRegularCount),
        paymentMethod: values.paymentMethod,
        customerId: values.customerId || undefined,
        orderSource: values.orderSource ?? (isAdminMode ? "admin_manual" : "web"),
        persistCustomerProfile: isAdminMode,
      });
      if (isAdminMode) {
        clearAdminOrderDraft();
      }
      onOrderSuccess(result.orderId, result.orderRef, values.paymentMethod, result.order);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit order.";
      if (
        message.includes("STOCK_CHANGED") ||
        message.includes("OPENER_STOCK_CHANGED") ||
        message.includes("PACKAGING_STOCK_CHANGED")
      ) {
        setSubmitError(t.invalidStockChange);
        notify(t.invalidStockChange, "error");
      } else {
        setSubmitError(message);
        notify(message, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, (errors) => {
    const firstErrorField = Object.keys(errors)[0] as keyof OrderSchemaInput | undefined;
    if (!firstErrorField) {
      notify(language === "th" ? "กรุณาตรวจสอบข้อมูลที่กรอก" : "Please check the form fields.", "error");
      return;
    }

    const fieldLabelMap: Partial<Record<keyof OrderSchemaInput, string>> = {
      name: t.name,
      phone: t.phone,
      email: t.email,
      deliveryLocation: t.deliveryLocation,
      paymentMethod: t.paymentMethod,
      locationLat: language === "th" ? "ตำแหน่งบนแผนที่" : "Map pin location",
      locationLng: language === "th" ? "ตำแหน่งบนแผนที่" : "Map pin location",
    };

    const fieldLabel = fieldLabelMap[firstErrorField] ?? (language === "th" ? "ข้อมูลที่กรอก" : "form fields");
    notify(
      language === "th"
        ? `กรุณาตรวจสอบช่อง: ${fieldLabel}`
        : `Please check required field: ${fieldLabel}`,
      "error",
    );
  });

  const paymentValue = form.watch("paymentMethod");
  const selectedCustomerId = form.watch("customerId");
  const watchedValues = form.watch();
  const selectedCustomer = customers.find((item) => item.id === selectedCustomerId);

  useEffect(() => {
    if (!isAdminMode || !hasRestoredAdminDraft) {
      return;
    }
    writeAdminOrderDraft({
      quantities,
      regularSpecialSlots,
      values: watchedValues,
    });
  }, [hasRestoredAdminDraft, isAdminMode, quantities, regularSpecialSlots, watchedValues]);

  useEffect(() => {
    if (!isAdminMode || !selectedCustomer) {
      return;
    }
    form.setValue("name", selectedCustomer.name, { shouldDirty: true });
    form.setValue("phone", selectedCustomer.phone, { shouldDirty: true });
    form.setValue("email", selectedCustomer.email ?? "", { shouldDirty: true });
    form.setValue("deliveryLocation", selectedCustomer.defaultDeliveryLocation ?? "", { shouldDirty: true });
    form.setValue("notes", selectedCustomer.notes ?? "", { shouldDirty: true });
  }, [form, isAdminMode, selectedCustomer]);

  const selectedLat = form.watch("locationLat");
  const selectedLng = form.watch("locationLng");
  const deliveryLocationValue = form.watch("deliveryLocation");

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {!onToast ? <ToastHost toast={localToast.toast} /> : null}
      <Card title={t.quantity}>
        <div className="mb-3 space-y-2">
          <p className="text-sm text-brand-redDark">
            {t.todayStock}: <strong>{gramsToKgLabel(remainingHoiGrams)}kg</strong>
          </p>
          <p className="text-xs text-slate-600">{t.canStillAdd}</p>
          <div className="flex flex-wrap gap-2">
            {activeProducts
              .filter((product) => product.stockType === "shared_hoi")
              .slice(0, 2)
              .map((product) => (
                <Badge key={product.id}>
                  {language === "th" ? product.thaiLabel : product.label}:{" "}
                  {Number.isFinite(canStillAddByProduct[product.id]) ? canStillAddByProduct[product.id] : "-"}
                </Badge>
              ))}
            <Badge tone={remainingOpeners > 0 ? "success" : "danger"}>
              {t.hoiOpener}: {Math.max(remainingOpeners, 0)}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          {activeProducts.map((product) => {
            const value = quantities[product.id] ?? 0;
            const canIncrease =
              product.stockType === "shared_hoi"
                ? (canStillAddByProduct[product.id] ?? 0) > 0
                : product.stockType === "opener"
                  ? remainingOpeners > 0
                  : true;
            return (
              <div key={product.id} className="space-y-2">
                <QuantityStepper
                  label={`${language === "th" ? product.thaiLabel : product.label} (${product.price} THB)`}
                  value={value}
                  canIncrease={canIncrease}
                  canDecrease={value > 0}
                  onIncrease={() => increment(product.id)}
                  onDecrease={() => decrement(product.id)}
                />
                {product.id === "regular" && value > 0 ? (
                  <RegularSpecialPicker
                    language={language}
                    regularQty={value}
                    slots={regularSpecialSlots}
                    baseHoiGrams={baseHoiGrams}
                    availableHoiGrams={stock.availableHoiGrams}
                    onToggleSlot={toggleRegularSpecialSlot}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={t.name}>
        <div className="space-y-3">
          {isAdminMode ? (
            <>
              <Select
                label={language === "th" ? "ลูกค้าเก่า (เลือกเพื่อกรอกอัตโนมัติ)" : "Existing customer (quick fill)"}
                options={[
                  { value: "", label: language === "th" ? "เลือกจากประวัติลูกค้า" : "Select saved customer" },
                  ...customers.map((customer) => ({
                    value: customer.id,
                    label: `${customer.name} (${customer.phone})`,
                  })),
                ]}
                {...form.register("customerId")}
              />
              <Select
                label={language === "th" ? "แหล่งที่มาออเดอร์" : "Order source"}
                options={(
                  ["admin_manual", "line", "phone", "walk_in", "web"] as OrderSource[]
                ).map((source) => ({
                  value: source,
                  label: sourceLabels[source],
                }))}
                {...form.register("orderSource")}
              />
            </>
          ) : null}
          <Input label={t.name} {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label={t.phone} {...form.register("phone")} error={form.formState.errors.phone?.message} />
          <Input label={`${t.email} (${t.optional})`} {...form.register("email")} />
          <Input
            label={t.deliveryLocation}
            {...form.register("deliveryLocation")}
            error={form.formState.errors.deliveryLocation?.message}
          />
          <div className="space-y-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsMapPickerOpen(true)}
              fullWidth
            >
              {t.pickPinOnMap}
            </Button>
            <p className="text-xs text-slate-600">
              {isResolvingDeliveryAddress && !deliveryLocationValue.trim()
                ? language === "th"
                  ? "กำลังค้นหาที่อยู่..."
                  : "Looking up address..."
                : Number.isFinite(selectedLat) && Number.isFinite(selectedLng)
                ? `Lat ${selectedLat.toFixed(6)}, Lng ${selectedLng.toFixed(6)}`
                : language === "th"
                  ? "กรุณาปักหมุดตำแหน่งบนแผนที่"
                  : "Please drop a pin on the map."}
            </p>
            {form.formState.errors.locationLat || form.formState.errors.locationLng ? (
              <p className="text-xs text-red-700">
                {language === "th" ? "ต้องปักหมุดตำแหน่งก่อนยืนยันออเดอร์" : "Map pin is required before submitting."}
              </p>
            ) : null}
          </div>
          <Input label={t.notes} {...form.register("notes")} />
          <Select
            label={t.paymentMethod}
            options={[
              { value: "cash", label: t.cashOnDelivery },
              { value: "bank_transfer", label: t.bankTransferOnDelivery },
            ]}
            {...form.register("paymentMethod")}
          />
        </div>
      </Card>

      <OrderSummary
        language={language}
        quantities={quantities}
        specialRegularCount={specialRegularCount}
        products={activeProducts}
        t={t}
        paymentLabel={paymentValue === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
      />

      <Alert tone="warning">{t.orderFinalWarning}</Alert>
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}
      <Button type="submit" fullWidth disabled={isSubmitting || (!orderingOpen && !isAdminMode)}>
        {isSubmitting ? (
          <>
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
            {language === "th" ? "กำลังส่ง..." : "Submitting..."}
          </>
        ) : (
          t.confirmOrder
        )}
      </Button>
      <MapPinPicker
        isOpen={isMapPickerOpen}
        title={t.pickPinOnMap}
        initialLat={Number.isFinite(selectedLat) ? selectedLat : undefined}
        initialLng={Number.isFinite(selectedLng) ? selectedLng : undefined}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={(lat, lng) => {
          void handleMapPinConfirm(lat, lng);
        }}
      />
    </form>
  );
}
