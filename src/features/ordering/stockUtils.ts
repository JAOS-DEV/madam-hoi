import type { ProductSettings } from "../../types/firestore";

export interface QuantityState {
  regular: number;
  small: number;
  extraSauce: number;
  opener: number;
}

export interface CalculatedOrderSummary {
  hoiGramsDeducted: number;
  includedSauce: number;
  extraSauce: number;
  totalSauce: number;
  subtotal: number;
  total: number;
}

export const createEmptyQuantities = (): QuantityState => ({
  regular: 0,
  small: 0,
  extraSauce: 0,
  opener: 0,
});

export function calculateOrderSummary(
  quantities: QuantityState,
  productSettings: ProductSettings,
): CalculatedOrderSummary {
  const regularTotal = quantities.regular * productSettings.regular.price;
  const smallTotal = quantities.small * productSettings.small.price;
  const extraSauceTotal = quantities.extraSauce * productSettings.extraSauce.price;
  const openerTotal = quantities.opener * productSettings.opener.price;
  const subtotal = regularTotal + smallTotal + extraSauceTotal + openerTotal;
  const includedSauce =
    quantities.regular * productSettings.regular.includedSauce +
    quantities.small * productSettings.small.includedSauce;
  const hoiGramsDeducted =
    quantities.regular * productSettings.regular.deductionGrams +
    quantities.small * productSettings.small.deductionGrams;

  return {
    hoiGramsDeducted,
    includedSauce,
    extraSauce: quantities.extraSauce,
    totalSauce: includedSauce + quantities.extraSauce,
    subtotal,
    total: subtotal,
  };
}

export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

export function gramsToKgLabel(grams: number): string {
  return (grams / 1000).toFixed(1).replace(".0", "");
}

export function getMaxAddable(
  availableHoiGrams: number,
  quantities: QuantityState,
  productSettings: ProductSettings,
): { regular: number; small: number } {
  const used =
    quantities.regular * productSettings.regular.deductionGrams +
    quantities.small * productSettings.small.deductionGrams;
  const remaining = Math.max(0, availableHoiGrams - used);
  return {
    regular: Math.floor(remaining / productSettings.regular.deductionGrams),
    small: Math.floor(remaining / productSettings.small.deductionGrams),
  };
}
