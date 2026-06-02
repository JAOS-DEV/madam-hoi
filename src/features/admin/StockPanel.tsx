import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import type { ToastTone } from "../../hooks/useToast";
import type { Language, Translation } from "../../i18n";
import type { ProductDoc, StockDoc } from "../../types/firestore";
import { getAdminErrorMessage } from "./adminToastErrors";
import { updateStock } from "./adminService";
import { getPackagingStock } from "../ordering/stockUtils";

interface StockPanelProps {
  stock: StockDoc;
  products: ProductDoc[];
  language: Language;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
}

export function StockPanel({ stock, products, language, t, onToast }: StockPanelProps): JSX.Element {
  const [kg, setKg] = useState((stock.availableHoiGrams / 1000).toString());
  const [openerStock, setOpenerStock] = useState(stock.openerStock.toString());
  const [regularPacks, setRegularPacks] = useState(getPackagingStock(stock).regularPacks.toString());
  const [smallPacks, setSmallPacks] = useState(getPackagingStock(stock).smallPacks.toString());
  const [sauceCups, setSauceCups] = useState(getPackagingStock(stock).sauceCups.toString());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const packagingStock = getPackagingStock(stock);
    setKg((stock.availableHoiGrams / 1000).toString());
    setOpenerStock(stock.openerStock.toString());
    setRegularPacks(packagingStock.regularPacks.toString());
    setSmallPacks(packagingStock.smallPacks.toString());
    setSauceCups(packagingStock.sauceCups.toString());
  }, [stock]);

  const capacity = useMemo(() => {
    const sharedHoiProducts = products.filter((product) => product.active && product.stockType === "shared_hoi");
    const regularProduct = sharedHoiProducts.find((product) => product.id === "regular") ?? sharedHoiProducts[0];
    const smallProduct =
      sharedHoiProducts.find((product) => product.id === "small") ??
      sharedHoiProducts.find((product) => product.id !== regularProduct?.id);
    return {
      regular:
        regularProduct && regularProduct.deductionGrams > 0
          ? Math.floor(stock.availableHoiGrams / regularProduct.deductionGrams)
          : 0,
      small:
        smallProduct && smallProduct.deductionGrams > 0
          ? Math.floor(stock.availableHoiGrams / smallProduct.deductionGrams)
          : 0,
    };
  }, [products, stock.availableHoiGrams]);

  const handleSave = async (): Promise<void> => {
    const kgValue = Number(kg);
    const openerValue = Number(openerStock);
    const regularPacksValue = Number(regularPacks);
    const smallPacksValue = Number(smallPacks);
    const sauceCupsValue = Number(sauceCups);
    if (
      !Number.isFinite(kgValue) ||
      !Number.isFinite(openerValue) ||
      !Number.isFinite(regularPacksValue) ||
      !Number.isFinite(smallPacksValue) ||
      !Number.isFinite(sauceCupsValue) ||
      kgValue < 0 ||
      openerValue < 0 ||
      regularPacksValue < 0 ||
      smallPacksValue < 0 ||
      sauceCupsValue < 0
    ) {
      onToast(t.toastGenericError, "error");
      return;
    }

    setIsSaving(true);
    try {
      await updateStock(kgValue, openerValue, {
        regularPacks: Math.floor(regularPacksValue),
        smallPacks: Math.floor(smallPacksValue),
        sauceCups: Math.floor(sauceCupsValue),
      });
      onToast(t.toastStockSaved, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title={language === "th" ? "สต็อกวันนี้" : "Stock"}>
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-900">
              {language === "th"
                ? `สต็อกหอยคงเหลือ: ${(stock.availableHoiGrams / 1000).toFixed(1)} kg`
                : `Current hoi remaining: ${(stock.availableHoiGrams / 1000).toFixed(1)} kg`}
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              {language === "th"
                ? "ชุดใหญ่และชุดเล็กใช้สต็อกหอยรวมเดียวกัน ตัวเลขด้านล่างคือจำนวนสูงสุดถ้าขายเฉพาะขนาดนั้น"
                : "Regular and small packs share the same hoi stock. These are maximum quantities if only that size is ordered."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-brand-gold/30 bg-white p-3">
              <p className="text-xs text-slate-500">{language === "th" ? "ชุดใหญ่ได้สูงสุด" : "Regular packs up to"}</p>
              <p className="mt-1 text-2xl font-bold text-brand-redDark">{capacity.regular}</p>
            </div>
            <div className="rounded-lg border border-brand-gold/30 bg-white p-3">
              <p className="text-xs text-slate-500">{language === "th" ? "ชุดเล็กได้สูงสุด" : "Small packs up to"}</p>
              <p className="mt-1 text-2xl font-bold text-brand-redDark">{capacity.small}</p>
            </div>
            <div className="rounded-lg border border-brand-gold/30 bg-white p-3">
              <p className="text-xs text-slate-500">{language === "th" ? "ที่แกะหอยเหลือ" : "Hoi openers left"}</p>
              <p className="mt-1 text-2xl font-bold text-brand-redDark">{stock.openerStock}</p>
            </div>
          </div>

          <div className="rounded-lg border border-brand-gold/30 bg-brand-cream/40 p-3">
            <p className="text-sm font-semibold text-brand-redDark">
              {language === "th" ? "สต็อกบรรจุภัณฑ์" : "Packaging stock"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {language === "th"
                ? "ระบบจะหักบรรจุภัณฑ์อัตโนมัติเมื่อมีออเดอร์ และคืนเมื่อยกเลิกพร้อมคืนสต็อก"
                : "Packaging is deducted automatically per order and restored when cancelling with stock restore."}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-brand-gold/30 bg-white p-3">
                <p className="text-xs text-slate-500">{language === "th" ? "กล่องชุดใหญ่" : "Regular packaging"}</p>
                <p className="mt-1 text-2xl font-bold text-brand-redDark">{getPackagingStock(stock).regularPacks}</p>
              </div>
              <div className="rounded-lg border border-brand-gold/30 bg-white p-3">
                <p className="text-xs text-slate-500">{language === "th" ? "กล่องชุดเล็ก" : "Small packaging"}</p>
                <p className="mt-1 text-2xl font-bold text-brand-redDark">{getPackagingStock(stock).smallPacks}</p>
              </div>
              <div className="rounded-lg border border-brand-gold/30 bg-white p-3">
                <p className="text-xs text-slate-500">{language === "th" ? "ถ้วยน้ำจิ้ม" : "Sauce cups"}</p>
                <p className="mt-1 text-2xl font-bold text-brand-redDark">{getPackagingStock(stock).sauceCups}</p>
              </div>
            </div>
          </div>

          <Input
            label={t.availableHoiStockKg}
            type="number"
            step="0.1"
            value={kg}
            onChange={(event) => setKg(event.target.value)}
          />
          <Input
            label={t.openerStockLabel}
            type="number"
            value={openerStock}
            onChange={(event) => setOpenerStock(event.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label={language === "th" ? "กล่องชุดใหญ่" : "Regular packaging"}
              type="number"
              value={regularPacks}
              onChange={(event) => setRegularPacks(event.target.value)}
            />
            <Input
              label={language === "th" ? "กล่องชุดเล็ก" : "Small packaging"}
              type="number"
              value={smallPacks}
              onChange={(event) => setSmallPacks(event.target.value)}
            />
            <Input
              label={language === "th" ? "ถ้วยน้ำจิ้ม" : "Sauce cups"}
              type="number"
              value={sauceCups}
              onChange={(event) => setSauceCups(event.target.value)}
            />
          </div>
          <Button onClick={() => void handleSave()} disabled={isSaving} aria-busy={isSaving}>
            {isSaving ? (
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
            ) : null}
            {t.saveStock}
          </Button>
        </div>
      </Card>
    </div>
  );
}
