import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { ToastTone } from "../../hooks/useToast";
import type { Language } from "../../i18n";
import type { OrderDoc, PrepRecipeDoc } from "../../types/firestore";
import { subscribePrepRecipes } from "../ordering/orderService";
import { seedDefaultPrepRecipes, upsertPrepRecipe } from "./adminService";
import { calculateShoppingList } from "./shoppingList";

interface ShoppingPrepPanelProps {
  language: Language;
  orders: Array<OrderDoc & { id: string }>;
  onToast: (message: string, tone: ToastTone) => void;
}

interface RecipeDraft {
  target: string;
  servingsSource: "total_sauce" | "orders_count";
  calcMode: "per_item" | "per_batch";
  servingsPerBatch: string;
  ingredientsText: string;
}

function toIngredientsText(recipe: PrepRecipeDoc): string {
  return recipe.ingredients
    .map((item) => `${item.name}|${item.amount}|${item.unit}|${item.wastePct ?? 0}`)
    .join("\n");
}

function toRecipeDraft(recipe: PrepRecipeDoc): RecipeDraft {
  return {
    target: recipe.target,
    servingsSource: recipe.servingsSource,
    calcMode: recipe.calcMode,
    servingsPerBatch: String(recipe.servingsPerBatch ?? 20),
    ingredientsText: toIngredientsText(recipe),
  };
}

export function ShoppingPrepPanel({ language, orders, onToast }: ShoppingPrepPanelProps): JSX.Element {
  const [recipes, setRecipes] = useState<PrepRecipeDoc[]>([]);
  const [recipeDrafts, setRecipeDrafts] = useState<Record<string, RecipeDraft>>({});

  useEffect(() => {
    const unsub = subscribePrepRecipes(
      (items) => {
        setRecipes(items);
        setRecipeDrafts((prev) => {
          const next = { ...prev };
          items.forEach((recipe) => {
            if (!next[recipe.id]) {
              next[recipe.id] = toRecipeDraft(recipe);
            }
          });
          return next;
        });
      },
      (error) => {
        onToast(error.message, "error");
      },
    );
    return () => {
      unsub();
    };
  }, [onToast]);

  const shoppingList = useMemo(
    () => calculateShoppingList(orders.filter((order) => order.archivedAt === undefined), recipes),
    [orders, recipes],
  );

  const handleSeedRecipes = async (): Promise<void> => {
    try {
      await seedDefaultPrepRecipes();
      onToast(language === "th" ? "เพิ่มสูตรเริ่มต้นแล้ว" : "Default recipes added.", "success");
    } catch (error) {
      if (error instanceof Error) {
        onToast(error.message, "error");
      } else {
        onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
      }
    }
  };

  const handleRecipeDraftChange = (recipeId: string, patch: Partial<RecipeDraft>): void => {
    setRecipeDrafts((prev) => ({
      ...prev,
      [recipeId]: {
        ...(prev[recipeId] ?? {
          target: "",
          servingsSource: "total_sauce",
          calcMode: "per_item",
          servingsPerBatch: "20",
          ingredientsText: "",
        }),
        ...patch,
      },
    }));
  };

  const handleSaveRecipe = async (recipeId: string): Promise<void> => {
    const draft = recipeDrafts[recipeId];
    if (!draft) {
      return;
    }
    const ingredients = draft.ingredientsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [nameRaw, amountRaw, unitRaw, wasteRaw] = line.split("|");
        return {
          name: (nameRaw ?? "").trim(),
          amount: Number(amountRaw ?? "0"),
          unit: (unitRaw ?? "").trim() || "unit",
          wastePct: Number(wasteRaw ?? "0"),
        };
      })
      .filter((item) => item.name && Number.isFinite(item.amount) && item.amount > 0);

    if (ingredients.length === 0) {
      onToast(language === "th" ? "กรุณาใส่วัตถุดิบอย่างน้อย 1 รายการ" : "Please add at least one ingredient.", "error");
      return;
    }

    try {
      await upsertPrepRecipe({
        id: recipeId,
        target: draft.target.trim() || recipeId,
        servingsSource: draft.servingsSource,
        calcMode: draft.calcMode,
        servingsPerBatch:
          draft.calcMode === "per_batch"
            ? Math.max(1, Number(draft.servingsPerBatch || "1"))
            : undefined,
        ingredients,
      });
      onToast(language === "th" ? "บันทึกสูตรแล้ว" : "Recipe saved.", "success");
    } catch (error) {
      if (error instanceof Error) {
        onToast(error.message, "error");
      } else {
        onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title={language === "th" ? "Shopping list จากออเดอร์" : "Shopping list from orders"}
        collapsible
        collapseStorageKey="admin.section.shopping-list"
      >
        {shoppingList.length === 0 ? (
          <p className="text-xs text-slate-600">
            {language === "th" ? "ยังไม่มีรายการวัตถุดิบจากออเดอร์ปัจจุบัน" : "No ingredient requirements yet."}
          </p>
        ) : (
          <div className="space-y-1 text-sm">
            {shoppingList.map((item) => (
              <p key={`${item.ingredient}-${item.unit}`}>
                <span className="font-semibold">{item.ingredient}</span>: {item.quantity.toFixed(2)} {item.unit}
                <span className="text-xs text-slate-500"> ({item.targets.join(", ")})</span>
              </p>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={language === "th" ? "ตั้งค่าสูตรวัตถุดิบ" : "Recipe configuration"}
        collapsible
        collapseStorageKey="admin.section.recipe-config"
        defaultCollapsed
      >
        <div className="mb-3">
          <Button size="compact" variant="secondary" onClick={() => void handleSeedRecipes()}>
            {language === "th" ? "เพิ่มสูตรเริ่มต้น" : "Seed default recipes"}
          </Button>
        </div>
        {recipes.length === 0 ? (
          <p className="text-xs text-slate-600">
            {language === "th"
              ? "ยังไม่มีสูตร กดปุ่ม Seed default recipes เพื่อสร้างข้อมูลตัวอย่าง"
              : "No recipes yet. Seed default recipes to start."}
          </p>
        ) : (
          <div className="space-y-3">
            {recipes.map((recipe) => {
              const draft = recipeDrafts[recipe.id] ?? toRecipeDraft(recipe);
              return (
                <div key={recipe.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      label={language === "th" ? "เป้าหมาย" : "Target"}
                      value={draft.target}
                      onChange={(event) => handleRecipeDraftChange(recipe.id, { target: event.target.value })}
                    />
                    <Select
                      label={language === "th" ? "อ้างอิงจำนวนเสิร์ฟ" : "Servings source"}
                      value={draft.servingsSource}
                      options={[
                        { value: "total_sauce", label: language === "th" ? "จำนวนน้ำจิ้มรวม" : "Total sauce servings" },
                        { value: "orders_count", label: language === "th" ? "จำนวนออเดอร์" : "Order count" },
                      ]}
                      onChange={(event) =>
                        handleRecipeDraftChange(recipe.id, {
                          servingsSource: event.target.value as "total_sauce" | "orders_count",
                        })
                      }
                    />
                    <Select
                      label={language === "th" ? "โหมดคำนวณ" : "Calc mode"}
                      value={draft.calcMode}
                      options={[
                        { value: "per_item", label: language === "th" ? "ต่อ 1 เสิร์ฟ" : "Per serving" },
                        { value: "per_batch", label: language === "th" ? "ต่อ 1 แบตช์" : "Per batch" },
                      ]}
                      onChange={(event) =>
                        handleRecipeDraftChange(recipe.id, {
                          calcMode: event.target.value as "per_item" | "per_batch",
                        })
                      }
                    />
                    {draft.calcMode === "per_batch" ? (
                      <Input
                        label={language === "th" ? "1 แบตช์ได้กี่เสิร์ฟ" : "Servings per batch"}
                        type="number"
                        value={draft.servingsPerBatch}
                        onChange={(event) => handleRecipeDraftChange(recipe.id, { servingsPerBatch: event.target.value })}
                      />
                    ) : null}
                  </div>
                  <label className="mt-2 block text-xs font-semibold text-brand-redDark/80">
                    {language === "th"
                      ? "วัตถุดิบ (บรรทัดละ ชื่อ|จำนวน|หน่วย|%เผื่อสูญเสีย)"
                      : "Ingredients (one per line: name|amount|unit|waste%)"}
                    <textarea
                      className="mt-1 w-full rounded-lg border border-brand-gold/40 px-3 py-2 font-mono text-xs"
                      rows={4}
                      value={draft.ingredientsText}
                      onChange={(event) => handleRecipeDraftChange(recipe.id, { ingredientsText: event.target.value })}
                    />
                  </label>
                  <div className="mt-2">
                    <Button size="compact" onClick={() => void handleSaveRecipe(recipe.id)}>
                      {language === "th" ? "บันทึกสูตร" : "Save recipe"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
