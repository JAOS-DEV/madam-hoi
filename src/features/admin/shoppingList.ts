import type { OrderDoc, PrepRecipeDoc } from "../../types/firestore";

export interface ShoppingListRow {
  ingredient: string;
  unit: string;
  quantity: number;
  targets: string[];
}

function getServingsForRecipe(recipe: PrepRecipeDoc, orders: Array<OrderDoc & { id: string }>): number {
  const activeOrders = orders.filter((order) => order.status !== "cancelled");
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
      });
    });
  });

  return Array.from(rows.values()).sort((a, b) => a.ingredient.localeCompare(b.ingredient));
}
