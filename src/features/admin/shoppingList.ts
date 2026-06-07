import type { Language } from "../../i18n";
import type { OrderDoc, PrepRecipeDoc, RecipeServingSourceConfig } from "../../types/firestore";
import { toDateOrNull } from "../../utils/dates";

export type ShoppingListScope = "today" | "open";

export const SHOPPING_LIST_SCOPE_KEY = "madam-hoi.today-shopping-scope";

export function readShoppingListScope(): ShoppingListScope {
  try {
    const stored = window.sessionStorage.getItem(SHOPPING_LIST_SCOPE_KEY);
    return stored === "open" ? "open" : "today";
  } catch {
    return "today";
  }
}

export function writeShoppingListScope(scope: ShoppingListScope): void {
  try {
    window.sessionStorage.setItem(SHOPPING_LIST_SCOPE_KEY, scope);
  } catch {
    // Ignore storage failures.
  }
}

export function getShoppingScopeDescription(
  scope: ShoppingListScope,
  orderCount: number,
  language: Language,
): string {
  if (scope === "today") {
    return language === "th"
      ? `จากออเดอร์วันนี้ ${orderCount} รายการ (ไม่รวมที่ยกเลิก)`
      : `From ${orderCount} today's orders (cancelled excluded).`;
  }
  return language === "th"
    ? `จากออเดอร์ที่ยังไม่เสร็จ ${orderCount} รายการ (ทุกวัน ไม่รวมที่ยกเลิก)`
    : `From ${orderCount} open orders across all days (not completed or cancelled).`;
}

export function getTodayShoppingOrders(orders: Array<OrderDoc & { id: string }>): Array<OrderDoc & { id: string }> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return orders.filter((order) => {
    const createdAt = toDateOrNull(order.createdAt);
    return createdAt !== null && createdAt >= start && order.archivedAt === undefined;
  });
}

export function getOpenShoppingOrders(orders: Array<OrderDoc & { id: string }>): Array<OrderDoc & { id: string }> {
  return orders.filter(
    (order) =>
      order.archivedAt === undefined && order.status !== "completed" && order.status !== "cancelled",
  );
}

export function getShoppingOrdersForScope(
  orders: Array<OrderDoc & { id: string }>,
  scope: ShoppingListScope,
): Array<OrderDoc & { id: string }> {
  return scope === "today" ? getTodayShoppingOrders(orders) : getOpenShoppingOrders(orders);
}

export function getShoppingOrderCount(orders: Array<OrderDoc & { id: string }>): number {
  return orders.filter((order) => order.status !== "cancelled").length;
}

export function formatShoppingListQuantity(item: Pick<ShoppingListRow, "kind" | "quantity">): string {
  if (item.kind === "hoi") {
    return item.quantity.toFixed(1).replace(/\.0$/, "");
  }
  return Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2);
}

export function getShoppingListLabel(item: Pick<ShoppingListRow, "kind" | "ingredient">, language: Language): string {
  if (item.kind === "hoi") {
    return language === "th" ? "หอยแครง" : "Hoi";
  }
  return item.ingredient;
}

export function getShoppingListDetail(
  item: Pick<ShoppingListRow, "kind" | "quantity" | "targets">,
  language: Language,
): string {
  if (item.kind === "hoi") {
    const grams = Math.round(item.quantity * 1000);
    return language === "th" ? `${grams} กรัม` : `${grams} g`;
  }
  return item.targets.join(", ");
}

export interface ShoppingListRow {
  ingredient: string;
  unit: string;
  quantity: number;
  targets: string[];
  kind?: "hoi" | "recipe";
}

function getProductQuantity(productId: string | undefined, orders: Array<OrderDoc & { id: string }>): number {
  if (!productId) {
    return 0;
  }
  return orders.reduce(
    (sum, order) =>
      sum +
      order.itemSnapshot
        .filter((item) => item.productId === productId)
        .reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );
}

function getServingsFromSource(source: RecipeServingSourceConfig, orders: Array<OrderDoc & { id: string }>): number {
  const activeOrders = orders.filter((order) => order.status !== "cancelled");
  if (source.type === "orders_count") {
    return activeOrders.length;
  }
  return getProductQuantity(source.productId, activeOrders);
}

function getActiveOrders(orders: Array<OrderDoc & { id: string }>): Array<OrderDoc & { id: string }> {
  return orders.filter((order) => order.status !== "cancelled");
}

function getHoiGramsRequired(orders: Array<OrderDoc & { id: string }>): number {
  return getActiveOrders(orders).reduce((sum, order) => sum + order.calculated.hoiGramsDeducted, 0);
}

function getServingsForRecipe(recipe: PrepRecipeDoc, orders: Array<OrderDoc & { id: string }>): number {
  if (recipe.servingsSources && recipe.servingsSources.length > 0) {
    return recipe.servingsSources.reduce((sum, source) => sum + getServingsFromSource(source, orders), 0);
  }
  const activeOrders = getActiveOrders(orders);
  if (recipe.servingsSource === "orders_count") {
    return activeOrders.length;
  }
  return activeOrders.reduce((sum, order) => sum + order.calculated.totalSauce, 0);
}

export function calculateShoppingList(
  orders: Array<OrderDoc & { id: string }>,
  recipes: PrepRecipeDoc[],
): ShoppingListRow[] {
  const rows = new Map<string, ShoppingListRow>();

  recipes.forEach((recipe) => {
    const servings = getServingsForRecipe(recipe, orders);
    if (servings <= 0) {
      return;
    }

    const multiplier =
      recipe.calcMode === "per_batch"
        ? servings / Math.max(recipe.servingsPerBatch ?? 1, 1)
        : servings;

    recipe.ingredients.forEach((ingredient) => {
      const amount = ingredient.amount * multiplier * (1 + (ingredient.wastePct ?? 0) / 100);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }
      const key = `${ingredient.name.trim().toLowerCase()}::${ingredient.unit.trim().toLowerCase()}`;
      const existing = rows.get(key);
      if (existing) {
        existing.quantity += amount;
        if (!existing.targets.includes(recipe.target)) {
          existing.targets.push(recipe.target);
        }
        return;
      }
      rows.set(key, {
        ingredient: ingredient.name.trim(),
        unit: ingredient.unit.trim(),
        quantity: amount,
        targets: [recipe.target],
        kind: "recipe",
      });
    });
  });

  const recipeRows = Array.from(rows.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  const hoiGrams = getHoiGramsRequired(orders);
  if (hoiGrams <= 0) {
    return recipeRows;
  }

  const hoiRow: ShoppingListRow = {
    ingredient: "Hoi",
    unit: "kg",
    quantity: hoiGrams / 1000,
    targets: [`${hoiGrams} g`],
    kind: "hoi",
  };

  return [hoiRow, ...recipeRows];
}
