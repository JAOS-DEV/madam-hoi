import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { ToastTone } from "../../hooks/useToast";
import type { Language } from "../../i18n";
import type { OrderDoc, PrepRecipeDoc, ProductDoc, RecipeServingSourceConfig } from "../../types/firestore";
import { subscribePrepRecipes } from "../ordering/orderService";
import { deletePrepRecipe, seedDefaultPrepRecipes, upsertPrepRecipe } from "./adminService";
import { calculateShoppingList } from "./shoppingList";

interface ShoppingPrepPanelProps {
  language: Language;
  orders: Array<OrderDoc & { id: string }>;
  products: ProductDoc[];
  onToast: (message: string, tone: ToastTone) => void;
}

interface RecipeDraft {
  target: string;
  servingsSource: "total_sauce" | "orders_count";
  servingsSources: RecipeServingSourceConfig[];
  calcMode: "per_item" | "per_batch";
  servingsPerBatch: string;
  ingredients: IngredientDraft[];
}

interface IngredientDraft {
  id: string;
  name: string;
  amount: string;
  unit: string;
  wastePct: string;
}

const unitOptions = ["pcs", "g", "kg", "ml", "l", "bottle", "bag", "pack", "unit"];

function createIngredientDraft(): IngredientDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    amount: "1",
    unit: "pcs",
    wastePct: "0",
  };
}

function createEmptyRecipeDraft(): RecipeDraft {
  return {
    target: "",
    servingsSource: "orders_count",
    servingsSources: [{ type: "orders_count" }],
    calcMode: "per_item",
    servingsPerBatch: "20",
    ingredients: [createIngredientDraft()],
  };
}

function legacySourceToSources(recipe: PrepRecipeDoc): RecipeServingSourceConfig[] {
  if (recipe.servingsSources && recipe.servingsSources.length > 0) {
    return recipe.servingsSources;
  }
  if (recipe.servingsSource === "orders_count") {
    return [{ type: "orders_count" }];
  }
  return [{ type: "orders_count" }, { type: "product_quantity", productId: "extra_sauce" }];
}

function toRecipeDraft(recipe: PrepRecipeDoc): RecipeDraft {
  return {
    target: recipe.target,
    servingsSource: recipe.servingsSource,
    servingsSources: legacySourceToSources(recipe),
    calcMode: recipe.calcMode,
    servingsPerBatch: String(recipe.servingsPerBatch ?? 20),
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: crypto.randomUUID(),
      name: ingredient.name,
      amount: String(ingredient.amount),
      unit: ingredient.unit || "pcs",
      wastePct: String(ingredient.wastePct ?? 0),
    })),
  };
}

function toRecipeId(target: string): string {
  const slug = target
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `recipe-${Date.now()}`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getRecipeSummary(recipe: PrepRecipeDoc, products: ProductDoc[], language: Language): string {
  const sources = legacySourceToSources(recipe).map((source) => {
    if (source.type === "orders_count") {
      return language === "th" ? "จำนวนออเดอร์" : "Order count";
    }
    const product = products.find((item) => item.id === source.productId);
    return language === "th"
      ? `จำนวนขาย: ${product?.thaiLabel ?? source.productId ?? "-"}`
      : `Sold: ${product?.label ?? source.productId ?? "-"}`;
  });
  const mode =
    recipe.calcMode === "per_batch"
      ? language === "th"
        ? `ต่อแบตช์ (${recipe.servingsPerBatch ?? 1} เสิร์ฟ)`
        : `Per batch (${recipe.servingsPerBatch ?? 1} servings)`
      : language === "th"
        ? "ต่อ 1 เสิร์ฟ"
        : "Per serving";
  return `${mode} • ${sources.join(" + ")}`;
}

export function ShoppingPrepPanel({ language, orders, products, onToast }: ShoppingPrepPanelProps): JSX.Element {
  const [recipes, setRecipes] = useState<PrepRecipeDoc[]>([]);
  const [recipeDrafts, setRecipeDrafts] = useState<Record<string, RecipeDraft>>({});
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [newRecipeDraft, setNewRecipeDraft] = useState<RecipeDraft>(createEmptyRecipeDraft);
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);

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

  const activeOrdersCount = orders.filter(
    (order) => order.archivedAt === undefined && order.status !== "cancelled",
  ).length;

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

  const handleDeleteRecipe = async (recipe: PrepRecipeDoc): Promise<void> => {
    const confirmed = window.confirm(
      language === "th" ? `ลบสูตร ${recipe.target}?` : `Delete recipe ${recipe.target}?`,
    );
    if (!confirmed) {
      return;
    }
    setDeletingRecipeId(recipe.id);
    try {
      await deletePrepRecipe(recipe.id);
      setEditingRecipeId((current) => (current === recipe.id ? null : current));
      onToast(language === "th" ? "ลบสูตรแล้ว" : "Recipe deleted.", "success");
    } catch (error) {
      if (error instanceof Error) {
        onToast(error.message, "error");
      } else {
        onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
      }
    } finally {
      setDeletingRecipeId(null);
    }
  };

  const handleRecipeDraftChange = (recipeId: string, patch: Partial<RecipeDraft>): void => {
    setRecipeDrafts((prev) => ({
      ...prev,
      [recipeId]: {
        ...(prev[recipeId] ?? createEmptyRecipeDraft()),
        ...patch,
      },
    }));
  };

  const updateIngredient = (
    draft: RecipeDraft,
    ingredientIndex: number,
    patch: Partial<IngredientDraft>,
  ): RecipeDraft => ({
    ...draft,
    ingredients: draft.ingredients.map((ingredient, index) =>
      index === ingredientIndex ? { ...ingredient, ...patch } : ingredient,
    ),
  });

  const removeIngredient = (draft: RecipeDraft, ingredientIndex: number): RecipeDraft => ({
    ...draft,
    ingredients: draft.ingredients.filter((_, index) => index !== ingredientIndex),
  });

  const addIngredient = (draft: RecipeDraft): RecipeDraft => ({
    ...draft,
    ingredients: [...draft.ingredients, createIngredientDraft()],
  });

  const updateServingSource = (
    draft: RecipeDraft,
    sourceIndex: number,
    patch: Partial<RecipeServingSourceConfig>,
  ): RecipeDraft => ({
    ...draft,
    servingsSources: draft.servingsSources.map((source, index) =>
      index === sourceIndex ? { ...source, ...patch } : source,
    ),
  });

  const removeServingSource = (draft: RecipeDraft, sourceIndex: number): RecipeDraft => ({
    ...draft,
    servingsSources: draft.servingsSources.filter((_, index) => index !== sourceIndex),
  });

  const addServingSource = (draft: RecipeDraft): RecipeDraft => ({
    ...draft,
    servingsSources: [...draft.servingsSources, { type: "product_quantity", productId: products[0]?.id }],
  });

  const toRecipePayload = (
    recipeId: string,
    draft: RecipeDraft,
  ): Omit<PrepRecipeDoc, "updatedAt"> | null => {
    const ingredients = draft.ingredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        amount: Number(ingredient.amount),
        unit: ingredient.unit.trim() || "unit",
        wastePct: Number(ingredient.wastePct || "0"),
      }))
      .filter((ingredient) => ingredient.name && Number.isFinite(ingredient.amount) && ingredient.amount > 0);

    if (ingredients.length === 0) {
      return null;
    }

    return {
      id: recipeId,
      target: draft.target.trim() || recipeId,
      servingsSource: draft.servingsSources.some((source) => source.type === "orders_count")
        ? "orders_count"
        : "total_sauce",
      servingsSources: draft.servingsSources
        .map((source) =>
          source.type === "orders_count"
            ? { type: "orders_count" as const }
            : { type: "product_quantity" as const, productId: source.productId },
        )
        .filter((source) => source.type === "orders_count" || Boolean(source.productId)),
      calcMode: draft.calcMode,
      servingsPerBatch:
        draft.calcMode === "per_batch" ? Math.max(1, Number(draft.servingsPerBatch || "1")) : undefined,
      ingredients,
    };
  };

  const handleSaveRecipe = async (recipeId: string, draft: RecipeDraft): Promise<void> => {
    if (!draft) {
      return;
    }
    const payload = toRecipePayload(recipeId, draft);
    if (!payload) {
      onToast(language === "th" ? "กรุณาใส่วัตถุดิบอย่างน้อย 1 รายการ" : "Please add at least one ingredient.", "error");
      return;
    }

    setSavingRecipeId(recipeId);
    try {
      await upsertPrepRecipe(payload);
      setEditingRecipeId(null);
      setIsAddingRecipe(false);
      setNewRecipeDraft(createEmptyRecipeDraft());
      onToast(language === "th" ? "บันทึกสูตรแล้ว" : "Recipe saved.", "success");
    } catch (error) {
      if (error instanceof Error) {
        onToast(error.message, "error");
      } else {
        onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
      }
    } finally {
      setSavingRecipeId(null);
    }
  };

  const renderRecipeEditor = (
    draft: RecipeDraft,
    onDraftChange: (nextDraft: RecipeDraft) => void,
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string,
    isSaving: boolean,
  ): JSX.Element => (
    <div className="space-y-4 border-t border-brand-gold/30 pt-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label={language === "th" ? "ชื่อสูตร / เป้าหมาย" : "Recipe name / target"}
          value={draft.target}
          onChange={(event) => onDraftChange({ ...draft, target: event.target.value })}
        />
        <Select
          label={language === "th" ? "โหมดคำนวณ" : "Calculation mode"}
          value={draft.calcMode}
          options={[
            { value: "per_item", label: language === "th" ? "ต่อ 1 เสิร์ฟ/ออเดอร์" : "Per serving/order" },
            { value: "per_batch", label: language === "th" ? "ต่อ 1 แบตช์" : "Per batch" },
          ]}
          onChange={(event) =>
            onDraftChange({ ...draft, calcMode: event.target.value as "per_item" | "per_batch" })
          }
        />
        {draft.calcMode === "per_batch" ? (
          <Input
            label={language === "th" ? "1 แบตช์ได้กี่เสิร์ฟ" : "Servings per batch"}
            type="number"
            min="1"
            value={draft.servingsPerBatch}
            onChange={(event) => onDraftChange({ ...draft, servingsPerBatch: event.target.value })}
          />
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-brand-redDark">
            {language === "th" ? "คำนวณจำนวนเสิร์ฟจาก" : "Calculate servings from"}
          </p>
          <p className="text-xs text-slate-600">
            {language === "th"
              ? "ระบบจะบวกแหล่งที่เลือกทั้งหมด เช่น จำนวนออเดอร์ + จำนวนสินค้าที่ขายเพิ่ม"
              : "Selected sources are added together, e.g. order count + extra product quantity sold."}
          </p>
        </div>
        {draft.servingsSources.map((source, index) => (
          <div key={`${index}-${source.type}-${source.productId ?? "orders"}`} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
            <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
              <Select
                label={language === "th" ? "แหล่งข้อมูล" : "Source"}
                value={source.type}
                options={[
                  { value: "orders_count", label: language === "th" ? "จำนวนออเดอร์" : "Order count" },
                  { value: "product_quantity", label: language === "th" ? "จำนวนสินค้าที่ขาย" : "Product quantity sold" },
                ]}
                onChange={(event) =>
                  onDraftChange(
                    updateServingSource(draft, index, {
                      type: event.target.value as RecipeServingSourceConfig["type"],
                      productId: event.target.value === "product_quantity" ? source.productId ?? products[0]?.id : undefined,
                    }),
                  )
                }
              />
              {source.type === "product_quantity" ? (
                <Select
                  label={language === "th" ? "สินค้า" : "Product"}
                  value={source.productId ?? ""}
                  options={products.map((product) => ({
                    value: product.id,
                    label: language === "th" ? product.thaiLabel : product.label,
                  }))}
                  onChange={(event) =>
                    onDraftChange(updateServingSource(draft, index, { productId: event.target.value }))
                  }
                />
              ) : (
                <p className="rounded-lg bg-brand-cream/60 px-3 py-2 text-xs text-slate-600">
                  {language === "th"
                    ? "นับ 1 เสิร์ฟต่อออเดอร์ที่ยังไม่ยกเลิก"
                    : "Counts 1 serving for each active non-cancelled order."}
                </p>
              )}
              <Button
                size="compact"
                variant="danger"
                onClick={() => onDraftChange(removeServingSource(draft, index))}
                disabled={draft.servingsSources.length <= 1}
              >
                {language === "th" ? "ลบ" : "Remove"}
              </Button>
            </div>
          </div>
        ))}
        <Button size="compact" variant="secondary" onClick={() => onDraftChange(addServingSource(draft))}>
          {language === "th" ? "เพิ่มแหล่งคำนวณ" : "Add source"}
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-brand-redDark">
            {language === "th" ? "วัตถุดิบ" : "Ingredients"}
          </p>
          <p className="text-xs text-slate-600">
            {language === "th"
              ? "เผื่อเพิ่ม (%) คือบัฟเฟอร์สำหรับของเสีย ของช้ำ หรือความผิดพลาดในการเตรียม ใช้ 0 ถ้าไม่ต้องการ"
              : "Extra allowance (%) adds a buffer for waste, spoilage, or prep mistakes. Use 0 if not needed."}
          </p>
        </div>
        {draft.ingredients.map((ingredient, index) => (
          <div key={ingredient.id} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
            <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-end">
              <Input
                label={language === "th" ? "ชื่อวัตถุดิบ" : "Ingredient"}
                value={ingredient.name}
                onChange={(event) => onDraftChange(updateIngredient(draft, index, { name: event.target.value }))}
              />
              <Input
                label={language === "th" ? "จำนวน" : "Amount"}
                type="number"
                step="0.01"
                value={ingredient.amount}
                onChange={(event) => onDraftChange(updateIngredient(draft, index, { amount: event.target.value }))}
              />
              <Select
                label={language === "th" ? "หน่วย" : "Unit"}
                value={ingredient.unit}
                options={unitOptions.map((unit) => ({ value: unit, label: unit }))}
                onChange={(event) => onDraftChange(updateIngredient(draft, index, { unit: event.target.value }))}
              />
              <Input
                label={language === "th" ? "เผื่อเพิ่ม (%)" : "Extra (%)"}
                type="number"
                step="1"
                value={ingredient.wastePct}
                onChange={(event) => onDraftChange(updateIngredient(draft, index, { wastePct: event.target.value }))}
              />
              <div className="md:pb-0">
                <Button
                  size="compact"
                  variant="danger"
                  onClick={() => onDraftChange(removeIngredient(draft, index))}
                  disabled={draft.ingredients.length <= 1}
                >
                  {language === "th" ? "ลบ" : "Remove"}
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button size="compact" variant="secondary" onClick={() => onDraftChange(addIngredient(draft))}>
          {language === "th" ? "เพิ่มวัตถุดิบ" : "Add ingredient"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="compact" variant="secondary" onClick={onCancel}>
          {language === "th" ? "ยกเลิก" : "Cancel"}
        </Button>
        <Button size="compact" onClick={onSave} disabled={isSaving} aria-busy={isSaving}>
          {isSaving ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
          ) : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card
        title={language === "th" ? "Shopping list จากออเดอร์" : "Shopping list from orders"}
        collapsible
        collapseStorageKey="admin.section.shopping-list"
      >
        <p className="mb-3 text-xs text-slate-600">
          {language === "th"
            ? `คำนวณจากออเดอร์ที่ยังใช้งานอยู่ ${activeOrdersCount} รายการ ไม่รวมออเดอร์ที่ยกเลิก`
            : `Calculated from ${activeOrdersCount} active orders. Cancelled orders are excluded.`}
        </p>
        {shoppingList.length === 0 ? (
          <div className="rounded-lg border border-brand-gold/30 bg-brand-cream/40 p-3">
            <p className="text-sm font-medium text-brand-redDark">
              {language === "th" ? "ยังไม่มีรายการเตรียมของ" : "No prep needed yet."}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {language === "th"
                ? "รายการซื้อจะแสดงเมื่อมีออเดอร์และมีสูตรวัตถุดิบแล้ว"
                : "Shopping requirements will appear when orders and recipes are configured."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shoppingList.map((item) => (
              <article key={`${item.ingredient}-${item.unit}`} className="rounded-lg border border-brand-gold/30 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-redDark">{item.ingredient}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.targets.join(", ")}</p>
                  </div>
                  <p className="shrink-0 text-lg font-bold text-emerald-700">
                    {formatQuantity(item.quantity)} <span className="text-xs font-medium text-slate-500">{item.unit}</span>
                  </p>
                </div>
              </article>
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
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Button size="compact" variant="secondary" onClick={() => setIsAddingRecipe((prev) => !prev)}>
            {isAddingRecipe
              ? language === "th"
                ? "ปิดฟอร์มเพิ่มสูตร"
                : "Close new recipe"
              : language === "th"
                ? "เพิ่มสูตรใหม่"
                : "Add new recipe"}
          </Button>
          <Button size="compact" variant="secondary" onClick={() => void handleSeedRecipes()}>
            {language === "th" ? "เพิ่มสูตรเริ่มต้น" : "Seed default recipes"}
          </Button>
        </div>

        {isAddingRecipe ? (
          <div className="mb-3">
            {renderRecipeEditor(
              newRecipeDraft,
              setNewRecipeDraft,
              () => void handleSaveRecipe(toRecipeId(newRecipeDraft.target), newRecipeDraft),
              () => {
                setIsAddingRecipe(false);
                setNewRecipeDraft(createEmptyRecipeDraft());
              },
              language === "th" ? "บันทึกสูตรใหม่" : "Save new recipe",
              savingRecipeId !== null,
            )}
          </div>
        ) : null}

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
                <div key={recipe.id} className="rounded-lg border border-brand-gold/30 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-redDark">{recipe.target}</p>
                      <p className="mt-1 text-xs text-slate-600">{getRecipeSummary(recipe, products, language)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {language === "th" ? "วัตถุดิบ" : "Ingredients"}: {recipe.ingredients.length}
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      {editingRecipeId === recipe.id ? (
                        <Button size="compact" variant="secondary" onClick={() => setEditingRecipeId(null)}>
                          {language === "th" ? "ปิด" : "Close"}
                        </Button>
                      ) : (
                        <Button size="compact" variant="secondary" onClick={() => setEditingRecipeId(recipe.id)}>
                          {language === "th" ? "แก้ไข" : "Edit"}
                        </Button>
                      )}
                      <Button
                        size="compact"
                        variant="danger"
                        onClick={() => void handleDeleteRecipe(recipe)}
                        disabled={deletingRecipeId === recipe.id}
                      >
                        {deletingRecipeId === recipe.id
                          ? language === "th"
                            ? "กำลังลบ..."
                            : "Deleting..."
                          : language === "th"
                            ? "ลบ"
                            : "Delete"}
                      </Button>
                    </div>
                  </div>
                  {editingRecipeId === recipe.id
                    ? renderRecipeEditor(
                        draft,
                        (nextDraft) => handleRecipeDraftChange(recipe.id, nextDraft),
                        () => void handleSaveRecipe(recipe.id, draft),
                        () => setEditingRecipeId(null),
                        language === "th" ? "บันทึกสูตร" : "Save recipe",
                        savingRecipeId === recipe.id,
                      )
                    : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
