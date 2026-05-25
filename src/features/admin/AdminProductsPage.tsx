import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
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

export function AdminProductsPage({
  language,
  products,
  onToggleLanguage,
}: AdminProductsPageProps): JSX.Element {
  const t = useMemo(() => translations[language], [language]);
  const [form, setForm] = useState<ProductFormState>(emptyForm);

  const handleCreate = async (): Promise<void> => {
    await addDoc(collection(db, "products"), {
      label: form.label,
      thaiLabel: form.thaiLabel,
      price: Number(form.price),
      active: true,
      stockType: form.stockType,
      deductionGrams: Number(form.deductionGrams),
      includedSauce: Number(form.includedSauce),
      category: form.category,
      mediaUrl: form.mediaUrl || undefined,
      mediaType: form.mediaType,
      sortOrder: Number(form.sortOrder),
    });
    setForm(emptyForm);
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <header className="flex items-center justify-between rounded-xl border border-brand-gold/30 bg-gradient-to-r from-brand-blush via-brand-cream to-amber-100 p-4 shadow-[0_10px_30px_-18px_rgba(127,29,29,0.7)]">
        <div>
          <h1 className="text-xl font-bold text-brand-red">{t.adminProductTitle}</h1>
          <p className="text-sm text-slate-600">
            {language === "th"
              ? "เพิ่ม แก้ไข เปิด/ปิด และลบสินค้าได้จากหน้านี้"
              : "Add, edit, enable/disable, and remove products here."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onToggleLanguage}>
            {t.languageToggle}
          </Button>
          <Link to="/admin">
            <Button variant="secondary">{language === "th" ? "กลับแดชบอร์ด" : "Back to dashboard"}</Button>
          </Link>
        </div>
      </header>

      <Card title={language === "th" ? "เพิ่มสินค้าใหม่" : "Add new product"}>
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
            label={language === "th" ? "ลำดับแสดงผล" : "Sort order"}
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
            options={[
              { value: "none", label: language === "th" ? "ไม่หักสต็อก" : "No stock deduction" },
              { value: "shared_hoi", label: language === "th" ? "หักจากสต็อกหอยรวม" : "Shared hoi stock" },
              { value: "opener", label: language === "th" ? "หักจากสต็อกที่แกะหอย" : "Opener stock" },
            ]}
          />
          <Select
            label={language === "th" ? "หมวดสินค้า" : "Category"}
            value={form.category}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, category: event.target.value as ProductCategory }))
            }
            options={[
              { value: "hoi", label: language === "th" ? "หอย" : "Hoi" },
              { value: "sauce", label: language === "th" ? "น้ำจิ้ม" : "Sauce" },
              { value: "tool", label: language === "th" ? "อุปกรณ์" : "Tool" },
              { value: "other", label: language === "th" ? "อื่นๆ" : "Other" },
            ]}
          />
          <Input
            label={language === "th" ? "หักสต็อก (กรัม)" : "Deduction grams"}
            type="number"
            value={form.deductionGrams}
            onChange={(event) => setForm((prev) => ({ ...prev, deductionGrams: event.target.value }))}
          />
          <Input
            label={language === "th" ? "น้ำจิ้มที่รวมให้ต่อชิ้น" : "Included sauce per unit"}
            type="number"
            value={form.includedSauce}
            onChange={(event) => setForm((prev) => ({ ...prev, includedSauce: event.target.value }))}
          />
          <Input
            label={language === "th" ? "ลิงก์รูป/วิดีโอ (ไม่บังคับ)" : "Image/video URL (optional)"}
            value={form.mediaUrl}
            onChange={(event) => setForm((prev) => ({ ...prev, mediaUrl: event.target.value }))}
          />
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
        </div>
        <div className="mt-3">
          <Button onClick={() => void handleCreate()}>{language === "th" ? "เพิ่มสินค้า" : "Add product"}</Button>
        </div>
      </Card>

      <Card title={language === "th" ? "สินค้าปัจจุบัน" : "Existing products"}>
        <div className="space-y-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-lg border border-brand-gold/30 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-brand-redDark">
                    {language === "th" ? product.thaiLabel : product.label}
                  </p>
                  <p className="text-sm text-slate-600">
                    {language === "th" ? "ราคา" : "Price"}: {product.price} THB
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void updateDoc(doc(db, "products", product.id), {
                        active: !product.active,
                      })
                    }
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
                    variant="danger"
                    onClick={() => void deleteDoc(doc(db, "products", product.id))}
                  >
                    {language === "th" ? "ลบ" : "Delete"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </main>
  );
}
