import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc, PaymentMethod, StockDoc } from "../../types/firestore";
import { calculateOrderSummary, createEmptyQuantities, getMaxAddable, gramsToKgLabel } from "./stockUtils";
import { QuantityStepper } from "./QuantityStepper";
import { orderSchema, type OrderSchemaInput } from "./orderSchema";
import { submitOrder } from "./orderService";
import { OrderSummary } from "./OrderSummary";

interface OrderFormProps {
  settings: MainSettingsDoc;
  stock: StockDoc;
  t: Translation;
  onOrderSuccess: (orderId: string, orderRef: string, paymentMethod: PaymentMethod) => void;
}

export function OrderForm({ settings, stock, t, onOrderSuccess }: OrderFormProps): JSX.Element {
  const [quantities, setQuantities] = useState(createEmptyQuantities());
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

  const summary = useMemo(
    () => calculateOrderSummary(quantities, settings.productSettings),
    [quantities, settings.productSettings],
  );
  const maxAddable = useMemo(
    () => getMaxAddable(stock.availableHoiGrams, quantities, settings.productSettings),
    [stock.availableHoiGrams, quantities, settings.productSettings],
  );
  const remainingHoiGrams = Math.max(0, stock.availableHoiGrams - summary.hoiGramsDeducted);
  const remainingOpeners = stock.openerStock - quantities.opener;

  const increment = (key: keyof typeof quantities): void => {
    setQuantities((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };
  const decrement = (key: keyof typeof quantities): void => {
    setQuantities((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
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
          <p className="text-sm text-slate-700">
            {t.todayStock}: <strong>{gramsToKgLabel(remainingHoiGrams)}kg</strong>
          </p>
          <p className="text-xs text-slate-600">{t.canStillAdd}</p>
          <div className="flex gap-2">
            <Badge>
              {t.regular}: {maxAddable.regular}
            </Badge>
            <Badge>
              {t.small}: {maxAddable.small}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <QuantityStepper
            label={`${t.regularHoi} (${settings.productSettings.regular.price} THB)`}
            value={quantities.regular}
            canIncrease={settings.productSettings.regular.active && maxAddable.regular > 0}
            canDecrease={quantities.regular > 0}
            onIncrease={() => increment("regular")}
            onDecrease={() => decrement("regular")}
          />
          <QuantityStepper
            label={`${t.smallHoi} (${settings.productSettings.small.price} THB)`}
            value={quantities.small}
            canIncrease={settings.productSettings.small.active && maxAddable.small > 0}
            canDecrease={quantities.small > 0}
            onIncrease={() => increment("small")}
            onDecrease={() => decrement("small")}
          />
          <QuantityStepper
            label={`${t.extraSauce} (${settings.productSettings.extraSauce.price} THB)`}
            value={quantities.extraSauce}
            canIncrease={settings.productSettings.extraSauce.active}
            canDecrease={quantities.extraSauce > 0}
            onIncrease={() => increment("extraSauce")}
            onDecrease={() => decrement("extraSauce")}
          />
          <QuantityStepper
            label={`${t.hoiOpener} (${settings.productSettings.opener.price} THB)`}
            value={quantities.opener}
            canIncrease={settings.productSettings.opener.active && remainingOpeners > 0}
            canDecrease={quantities.opener > 0}
            onIncrease={() => increment("opener")}
            onDecrease={() => decrement("opener")}
          />
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
        quantities={quantities}
        productSettings={settings.productSettings}
        t={t}
        paymentLabel={paymentValue === "bank_transfer" ? t.bankTransferOnDelivery : t.cashOnDelivery}
      />

      <Alert tone="warning">{t.orderFinalWarning}</Alert>
      {submitError ? <Alert tone="error">{submitError}</Alert> : null}
      <Button type="submit" fullWidth disabled={isSubmitting || !settings.orderingOpen}>
        {isSubmitting ? "Submitting..." : t.confirmOrder}
      </Button>
    </form>
  );
}
