import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Toast } from "../../components/ui/Toast";
import { db } from "../../lib/firebase";
import { translations, type Language } from "../../i18n";
import type { ProductDoc, ProductStockType, ProductCategory } from "../../types/firestore";

interface AdminProductsPageProps {
  language: Language;
  products: ProductDoc[];
  onToggleLanguage: () => void;
}

interface ProductFormState {
  label: string;
  thaiLabel: string;
  price: string;
  stockType: ProductStockType;
  deductionGrams: string;
  includedSauce: string;
  category: ProductCategory;
  mediaUrl: string;
  mediaType: "image" | "video";
  sortOrder: string;
}

interface ProductToast {
  message: string;
  tone: "success" | "error";
}

const emptyForm: ProductFormState = {
  label: "",
  thaiLabel: "",
  price: "0",
  stockType: "none",
  deductionGrams: "0",
  includedSauce: "0",
  category: "other",
  mediaUrl: "",
  mediaType: "image",
  sortOrder: "999",
};

const toSafeNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function AdminProductsPage({
  language,
  products,
  onToggleLanguage,
}: AdminProductsPageProps): JSX.Element {
  const t = useMemo(() => translations[language], [language]);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [editingById, setEditingById] = useState<Record<string, ProductFormState>>({});
  const [toast, setToast] = useState<ProductToast | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const stockOptions = useMemo(
    () => [
      {
        value: "none",
        label:
          language === "th"
            ? "ไม่หักสต็อก (เหมาะกับสินค้าเสริม)"
            : "No stock deduction (best for add-ons)",
      },
      {
        value: "shared_hoi",
        label:
          language === "th"
            ? "หักจากสต็อกหอยรวม (กรัม)"
            : "Deduct from shared hoi stock (grams)",
      },
      {
        value: "opener",
        label:
          language === "th"
            ? "หักจากสต็อกที่แกะหอย (จำนวนชิ้น)"
            : "Deduct from opener stock (units)",
      },
    ],
    [language],
  );
  const categoryOptions = useMemo(
    () => [
      { value: "hoi", label: language === "th" ? "หอย" : "Hoi" },
      { value: "sauce", label: language === "th" ? "น้ำจิ้ม" : "Sauce" },
      { value: "tool", label: language === "th" ? "อุปกรณ์" : "Tool" },
      { value: "other", label: language === "th" ? "อื่นๆ" : "Other" },
    ],
    [language],
  );

  const toFormState = (product: ProductDoc): ProductFormState => ({
    label: product.label,
    thaiLabel: product.thaiLabel,
    price: String(product.price),
    stockType: product.stockType,
    deductionGrams: String(product.deductionGrams),
    includedSauce: String(product.includedSauce),
    category: product.category,
    mediaUrl: product.mediaUrl ?? "",
    mediaType: product.mediaType ?? "image",
    sortOrder: String(product.sortOrder),
  });

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 2800);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const showToast = (message: string, tone: ProductToast["tone"]): void => {
    setToast({ message, tone });
  };

  const getReadableError = (error: unknown): string => {
    if (error instanceof Error) {
      if (error.message.includes("Missing or insufficient permissions")) {
        return language === "th"
          ? "ไม่มีสิทธิ์แก้ไขสินค้า กรุณาตรวจสอบอีเมลแอดมินใน Firestore Rules"
          : "You do not have permission to edit products. Check admin emails in Firestore rules.";
      }
      return error.message;
    }
    return language === "th" ? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" : "Something went wrong. Please try again.";
  };

  const normalizePayload = (
    state: ProductFormState,
    active: boolean,
  ): Omit<ProductDoc, "id"> => {
    const label = state.label.trim();
    const thaiLabel = state.thaiLabel.trim();
    const mediaUrl = state.mediaUrl.trim();
    return {
      label,
      thaiLabel,
      price: Math.max(0, toSafeNumber(state.price, 0)),
      active,
      stockType: state.stockType,
      deductionGrams:
        state.stockType === "shared_hoi" ? Math.max(0, toSafeNumber(state.deductionGrams, 0)) : 0,
      includedSauce: state.category === "hoi" ? Math.max(0, toSafeNumber(state.includedSauce, 0)) : 0,
      category: state.category,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaUrl ? state.mediaType : undefined,
      sortOrder: Math.max(0, Math.floor(toSafeNumber(state.sortOrder, 999))),
    };
  };

  const validateProduct = (state: ProductFormState): string | null => {
    if (!state.label.trim() || !state.thaiLabel.trim()) {
      return language === "th"
        ? "กรุณากรอกชื่อสินค้าให้ครบทั้ง EN และ TH"
        : "Please fill both EN and TH product names.";
    }
    if (toSafeNumber(state.price, -1) < 0) {
      return language === "th" ? "ราคาต้องมากกว่าหรือเท่ากับ 0" : "Price must be 0 or greater.";
    }
    return null;
  };

  const handleCreate = async (): Promise<void> => {
    const validationError = validateProduct(form);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }
    setIsCreating(true);
    try {
      const payload = normalizePayload(form, true);
      await addDoc(collection(db, "products"), payload);
      setForm(emptyForm);
      showToast(language === "th" ? "เพิ่มสินค้าเรียบร้อยแล้ว" : "Product added successfully.", "success");
    } catch (error) {
      showToast(getReadableError(error), "error");
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (product: ProductDoc): void => {
    setEditingById((prev) => ({
      ...prev,
      [product.id]: toFormState(product),
    }));
  };

  const cancelEdit = (productId: string): void => {
    setEditingById((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const updateEditingField = (
    productId: string,
    field: keyof ProductFormState,
    value: string,
  ): void => {
    setEditingById((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const saveEdit = async (productId: string): Promise<void> => {
    const edit = editingById[productId];
    if (!edit) {
      return;
    }
    const validationError = validateProduct(edit);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }
    setSavingId(productId);
    try {
      const existingProduct = products.find((item) => item.id === productId);
      const payload = normalizePayload(edit, existingProduct?.active ?? true);
      await updateDoc(doc(db, "products", productId), payload);
      cancelEdit(productId);
      showToast(language === "th" ? "บันทึกสินค้าแล้ว" : "Product saved successfully.", "success");
    } catch (error) {
      showToast(getReadableError(error), "error");
    } finally {
      setSavingId(null);
    }
  };

  const toggleProductActive = async (product: ProductDoc): Promise<void> => {
    setTogglingId(product.id);
    try {
      await updateDoc(doc(db, "products", product.id), {
        active: !product.active,
      });
      showToast(
        product.active
          ? language === "th"
            ? "ปิดการขายสินค้าแล้ว"
            : "Product disabled."
          : language === "th"
            ? "เปิดการขายสินค้าแล้ว"
            : "Product enabled.",
        "success",
      );
    } catch (error) {
      showToast(getReadableError(error), "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (productId: string): Promise<void> => {
    const confirmed = window.confirm(
      language === "th" ? "ยืนยันการลบสินค้านี้?" : "Delete this product?",
    );
    if (!confirmed) {
      return;
    }
    setDeletingId(productId);
    try {
      await deleteDoc(doc(db, "products", productId));
      cancelEdit(productId);
      showToast(language === "th" ? "ลบสินค้าเรียบร้อยแล้ว" : "Product deleted.", "success");
    } catch (error) {
      showToast(getReadableError(error), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[1100] flex justify-center px-3">
          <div className="w-full max-w-md">
            <Toast message={toast.message} tone={toast.tone} />
          </div>
        </div>
      ) : null}
      <header className="rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-blush via-brand-cream to-amber-100 p-3 sm:p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
        <div className="space-y-3">
          <div>
            <h1 className="text-lg font-bold text-brand-red sm:text-xl">{t.adminProductTitle}</h1>
            <p className="text-sm text-slate-600">
              {language === "th"
                ? "เพิ่ม แก้ไข เปิด/ปิด และลบสินค้าได้จากหน้านี้"
                : "Add, edit, enable/disable, and remove products here."}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button size="compact" variant="secondary" onClick={onToggleLanguage}>
              {t.languageToggle}
            </Button>
            <Link to="/admin" className="w-full sm:w-auto">
              <Button size="compact" fullWidth variant="secondary">
                {language === "th" ? "กลับแดชบอร์ด" : "Back to dashboard"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <Card title={language === "th" ? "เพิ่มสินค้าใหม่" : "Add new product"}>
        <p className="mb-3 text-xs text-slate-600">
          {language === "th"
            ? "แนะนำ: สินค้าเสริมให้เลือก 'ไม่หักสต็อก', หอยให้เลือก 'หักจากสต็อกหอยรวม'"
            : "Tip: use 'No stock deduction' for add-ons, and 'Shared hoi stock' for cockle packs."}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label={language === "th" ? "ชื่อสินค้า (อังกฤษ)" : "Product name (EN)"}
            value={form.label}
            onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
          />
          <Input
            label={language === "th" ? "ชื่อสินค้า (ไทย)" : "Product name (TH)"}
            value={form.thaiLabel}
            onChange={(event) => setForm((prev) => ({ ...prev, thaiLabel: event.target.value }))}
          />
          <Input
            label={language === "th" ? "ราคา" : "Price"}
            type="number"
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
          />
          <Input
            label={language === "th" ? "ลำดับแสดงผล (เลขน้อยขึ้นก่อน)" : "Display order (lower first)"}
            type="number"
            value={form.sortOrder}
            onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
          />
          <Select
            label={language === "th" ? "การหักสต็อก" : "Stock behavior"}
            value={form.stockType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, stockType: event.target.value as ProductStockType }))
            }
            options={stockOptions}
          />
          <Select
            label={language === "th" ? "หมวดสินค้า" : "Category"}
            value={form.category}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, category: event.target.value as ProductCategory }))
            }
            options={categoryOptions}
          />
          {form.stockType === "shared_hoi" ? (
            <Input
              label={language === "th" ? "หักสต็อก (กรัม)" : "Deduction grams"}
              type="number"
              value={form.deductionGrams}
              onChange={(event) => setForm((prev) => ({ ...prev, deductionGrams: event.target.value }))}
            />
          ) : null}
          {form.category === "hoi" ? (
            <Input
              label={language === "th" ? "น้ำจิ้มที่รวมให้ต่อชิ้น" : "Included sauce per unit"}
              type="number"
              value={form.includedSauce}
              onChange={(event) => setForm((prev) => ({ ...prev, includedSauce: event.target.value }))}
            />
          ) : null}
          <Input
            label={language === "th" ? "ลิงก์รูป/วิดีโอ (ไม่บังคับ)" : "Image/video URL (optional)"}
            value={form.mediaUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, mediaUrl: event.target.value }))}
          />
          {form.mediaUrl.trim() ? (
            <Select
              label={language === "th" ? "ประเภทสื่อ" : "Media type"}
              value={form.mediaType}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, mediaType: event.target.value as "image" | "video" }))
              }
              options={[
                { value: "image", label: language === "th" ? "รูปภาพ" : "Image" },
                { value: "video", label: language === "th" ? "วิดีโอ" : "Video" },
              ]}
            />
          ) : null}
        </div>
        <div className="mt-3">
          <Button onClick={() => void handleCreate()} disabled={isCreating}>
            {isCreating
              ? language === "th"
                ? "กำลังเพิ่ม..."
                : "Adding..."
              : language === "th"
                ? "เพิ่มสินค้า"
                : "Add product"}
          </Button>
        </div>
      </Card>

      <Card title={language === "th" ? "สินค้าปัจจุบัน" : "Existing products"}>
        <div className="space-y-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-lg border border-brand-gold/30 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-redDark">
                    {language === "th" ? product.thaiLabel : product.label}
                  </p>
                  <p className="text-sm text-slate-600">
                    {language === "th" ? "ราคา" : "Price"}: {product.price} THB
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  {editingById[product.id] ? (
                    <>
                      <Button size="compact" variant="secondary" onClick={() => cancelEdit(product.id)}>
                        {language === "th" ? "ยกเลิก" : "Cancel"}
                      </Button>
                      <Button
                        size="compact"
                        onClick={() => void saveEdit(product.id)}
                        disabled={savingId === product.id}
                      >
                        {savingId === product.id
                          ? language === "th"
                            ? "กำลังบันทึก..."
                            : "Saving..."
                          : language === "th"
                            ? "บันทึก"
                            : "Save"}
                      </Button>
                    </>
                  ) : (
                    <Button size="compact" variant="secondary" onClick={() => startEdit(product)}>
                      {language === "th" ? "แก้ไข" : "Edit"}
                    </Button>
                  )}
                  <Button
                    size="compact"
                    variant="secondary"
                    onClick={() => void toggleProductActive(product)}
                    disabled={togglingId === product.id}
                  >
                    {product.active
                      ? language === "th"
                        ? "ปิดการขาย"
                        : "Disable"
                      : language === "th"
                        ? "เปิดการขาย"
                        : "Enable"}
                  </Button>
                  <Button
                    size="compact"
                    variant="danger"
                    onClick={() => void handleDelete(product.id)}
                    disabled={deletingId === product.id}
                  >
                    {deletingId === product.id
                      ? language === "th"
                        ? "กำลังลบ..."
                        : "Deleting..."
                      : language === "th"
                        ? "ลบ"
                        : "Delete"}
                  </Button>
                </div>
              </div>
              {editingById[product.id] ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Input
                    label={language === "th" ? "ชื่อสินค้า (อังกฤษ)" : "Product name (EN)"}
                    value={editingById[product.id].label}
                    onChange={(event) => updateEditingField(product.id, "label", event.target.value)}
                  />
                  <Input
                    label={language === "th" ? "ชื่อสินค้า (ไทย)" : "Product name (TH)"}
                    value={editingById[product.id].thaiLabel}
                    onChange={(event) => updateEditingField(product.id, "thaiLabel", event.target.value)}
                  />
                  <Input
                    label={language === "th" ? "ราคา" : "Price"}
                    type="number"
                    value={editingById[product.id].price}
                    onChange={(event) => updateEditingField(product.id, "price", event.target.value)}
                  />
                  <Input
                    label={language === "th" ? "ลำดับแสดงผล (เลขน้อยขึ้นก่อน)" : "Display order (lower first)"}
                    type="number"
                    value={editingById[product.id].sortOrder}
                    onChange={(event) => updateEditingField(product.id, "sortOrder", event.target.value)}
                  />
                  <Select
                    label={language === "th" ? "การหักสต็อก" : "Stock behavior"}
                    value={editingById[product.id].stockType}
                    onChange={(event) =>
                      updateEditingField(product.id, "stockType", event.target.value)
                    }
                    options={stockOptions}
                  />
                  <Select
                    label={language === "th" ? "หมวดสินค้า" : "Category"}
                    value={editingById[product.id].category}
                    onChange={(event) => updateEditingField(product.id, "category", event.target.value)}
                    options={categoryOptions}
                  />
                  {editingById[product.id].stockType === "shared_hoi" ? (
                    <Input
                      label={language === "th" ? "หักสต็อก (กรัม)" : "Deduction grams"}
                      type="number"
                      value={editingById[product.id].deductionGrams}
                      onChange={(event) => updateEditingField(product.id, "deductionGrams", event.target.value)}
                    />
                  ) : null}
                  {editingById[product.id].category === "hoi" ? (
                    <Input
                      label={language === "th" ? "น้ำจิ้มที่รวมให้ต่อชิ้น" : "Included sauce per unit"}
                      type="number"
                      value={editingById[product.id].includedSauce}
                      onChange={(event) => updateEditingField(product.id, "includedSauce", event.target.value)}
                    />
                  ) : null}
                  <Input
                    label={language === "th" ? "ลิงก์รูป/วิดีโอ (ไม่บังคับ)" : "Image/video URL (optional)"}
                    value={editingById[product.id].mediaUrl}
                    onChange={(event) => updateEditingField(product.id, "mediaUrl", event.target.value)}
                  />
                  {editingById[product.id].mediaUrl.trim() ? (
                    <Select
                      label={language === "th" ? "ประเภทสื่อ" : "Media type"}
                      value={editingById[product.id].mediaType}
                      onChange={(event) => updateEditingField(product.id, "mediaType", event.target.value)}
                      options={[
                        { value: "image", label: language === "th" ? "รูปภาพ" : "Image" },
                        { value: "video", label: language === "th" ? "วิดีโอ" : "Video" },
                      ]}
                    />
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </Card>
    </main>
  );
}
