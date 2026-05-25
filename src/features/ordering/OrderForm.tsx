import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { Language, Translation } from "../../i18n";
import type { OrderQuantities, PaymentMethod, ProductDoc, StockDoc } from "../../types/firestore";
import { gramsToKgLabel } from "./stockUtils";
import { QuantityStepper } from "./QuantityStepper";
import { orderSchema, type OrderSchemaInput } from "./orderSchema";
import { submitOrder } from "./orderService";
import { OrderSummary } from "./OrderSummary";

interface OrderFormProps {
  language: Language;
  orderingOpen: boolean;
  stock: StockDoc;
  products: ProductDoc[];
  t: Translation;
  onOrderSuccess: (orderId: string, orderRef: string, paymentMethod: PaymentMethod) => void;
}

const createEmptyQuantities = (products: ProductDoc[]): OrderQuantities =>
  Object.fromEntries(products.map((product) => [product.id, 0]));

export function OrderForm({
  language,
  orderingOpen,
  stock,
  products,
  t,
  onOrderSuccess,
}: OrderFormProps): JSX.Element {
  const activeProducts = useMemo(
    () => products.filter((product) => product.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [products],
  );
  const [quantities, setQuantities] = useState<OrderQuantities>(() =>
    createEmptyQuantities(activeProducts),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const form = useForm<OrderSchemaInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      deliveryLocation: "",
      notes: "",
      paymentMethod: "cash",
    },
  });

  useEffect(() => {
    setQuantities((prev) => {
      const next = createEmptyQuantities(activeProducts);
      activeProducts.forEach((product) => {
        next[product.id] = prev[product.id] ?? 0;
      });
      return next;
    });
  }, [activeProducts]);

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
    const total = selected.reduce((sum, item) => sum + item.qty * item.product.price, 0);
    return {
      hoiGramsDeducted,
      includedSauce,
      extraSauce,
      totalSauce: includedSauce + extraSauce,
      total,
      subtotal: total,
    };
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

  const onSubmit = form.handleSubmit(async (values) => {
    if (summary.total <= 0) {
      setSubmitError("Please add at least one paid item.");
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
          notes: values.notes || undefined,
        },
        quantities,
        paymentMethod: values.paymentMethod,
      });
      onOrderSuccess(result.orderId, result.orderRef, values.paymentMethod);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit order.";
      if (message.includes("STOCK_CHANGED") || message.includes("OPENER_STOCK_CHANGED")) {
        setSubmitError(t.invalidStockChange);
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const paymentValue = form.watch("paymentMethod");

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Card title={t.quantity}>
        <div className="mb-3 space-y-2">
          <p className="text-sm text-brand-redDark">
            {t.todayStock}: <strong>{gramsToKgLabel(remainingHoiGrams)}kg</strong>
          </p>
          <p className="text-xs text-slate-600">{t.canStillAdd}</p>
          <div className="flex gap-2">
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
              <QuantityStepper
                key={product.id}
                label={`${language === "th" ? product.thaiLabel : product.label} (${product.price} THB)`}
                value={value}
                canIncrease={canIncrease}
                canDecrease={value > 0}
                onIncrease={() => increment(product.id)}
                onDecrease={() => decrement(product.id)}
              />
            );
          })}
        </div>
      </Card>

      <Card title={t.name}>
        <div className="space-y-3">
          <Input label={t.name} {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label={t.phone} {...form.register("phone")} error={form.formState.errors.phone?.message} />
          <Input label={`${t.email} (${t.optional})`} {...form.register("email")} />
          <Input
            label={t.deliveryLocation}
            {...form.register("deliveryLocation")}
            error={form.formState.errors.deliveryLocation?.message}
          />
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
        products={activeProducts}
        t={t}
        paymentLabel={paymentValue === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
      />

      <Alert tone="warning">{t.orderFinalWarning}</Alert>
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}
      <Button type="submit" fullWidth disabled={isSubmitting || !orderingOpen}>
        {isSubmitting ? "Submitting..." : t.confirmOrder}
      </Button>
    </form>
  );
}
