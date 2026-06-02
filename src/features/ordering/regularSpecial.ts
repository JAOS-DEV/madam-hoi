export const REGULAR_SPECIAL_KEY = "regular_special";
export const SPECIAL_EXTRA_HOI_GRAMS = 500;
export const SPECIAL_EXTRA_PRICE_THB = 100;

export function countRegularSpecialSlots(slots: boolean[]): number {
  return slots.filter(Boolean).length;
}

export function syncRegularSpecialSlots(prev: boolean[], regularQty: number): boolean[] {
  if (regularQty <= 0) {
    return [];
  }
  const next = prev.slice(0, regularQty);
  while (next.length < regularQty) {
    next.push(false);
  }
  return next;
}

export function canEnableAnotherSpecialSlot(
  slots: boolean[],
  regularQty: number,
  baseHoiGrams: number,
  availableHoiGrams: number,
): boolean {
  const current = countRegularSpecialSlots(slots);
  const nextCount = current + 1;
  if (nextCount > regularQty) {
    return false;
  }
  return baseHoiGrams + nextCount * SPECIAL_EXTRA_HOI_GRAMS <= availableHoiGrams;
}

export function buildQuantitiesWithSpecial(
  quantities: Record<string, number>,
  specialRegularCount: number,
): Record<string, number> {
  const next = { ...quantities };
  if (specialRegularCount <= 0) {
    delete next[REGULAR_SPECIAL_KEY];
    return next;
  }
  next[REGULAR_SPECIAL_KEY] = specialRegularCount;
  return next;
}
