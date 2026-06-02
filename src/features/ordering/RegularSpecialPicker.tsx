import type { Language } from "../../i18n";
import { canEnableAnotherSpecialSlot } from "./regularSpecial";

interface RegularSpecialPickerProps {
  language: Language;
  regularQty: number;
  slots: boolean[];
  baseHoiGrams: number;
  availableHoiGrams: number;
  onToggleSlot: (index: number) => void;
}

export function RegularSpecialPicker({
  language,
  regularQty,
  slots,
  baseHoiGrams,
  availableHoiGrams,
  onToggleSlot,
}: RegularSpecialPickerProps): JSX.Element | null {
  if (regularQty <= 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-brand-gold/30 bg-amber-50/40 p-2.5">
      <p className="text-sm font-medium text-brand-redDark">
        {language === "th" ? "หอยชุดใหญ่พิเศษ (+500 กรัม, +100 บาท ต่อชุด)" : "Regular special (+500g hoi, +100 THB each)"}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {language === "th"
          ? "เลือกแต่ละชุดที่ต้องการเพิ่มหอยพิเศษ (ไม่เพิ่มน้ำจิ้มหรือสลัด)"
          : "Tick each pack that needs extra hoi (no extra sauce or salad)."}
      </p>
      <div className="mt-2 space-y-2">
        {Array.from({ length: regularQty }, (_, index) => {
          const checked = slots[index] ?? false;
          const canEnable = checked
            ? true
            : canEnableAnotherSpecialSlot(slots, regularQty, baseHoiGrams, availableHoiGrams);
          return (
            <label
              key={`regular-special-${index}`}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                checked ? "border-brand-gold bg-white" : "border-brand-gold/30 bg-white/70"
              } ${canEnable ? "" : "cursor-not-allowed opacity-50"}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-brand-gold/50"
                checked={checked}
                disabled={!canEnable}
                onChange={() => onToggleSlot(index)}
              />
              <span className="font-medium text-brand-redDark">
                {language === "th" ? `ชุดที่ ${index + 1}` : `Pack ${index + 1}`}
                {" — "}
                {language === "th" ? "พิเศษ" : "Special"}
              </span>
            </label>
          );
        })}
      </div>
      {regularQty > 1 ? (
        <p className="mt-2 text-xs text-slate-600">
          {language === "th"
            ? `เลือกแล้ว ${slots.filter(Boolean).length} จาก ${regularQty} ชุด`
            : `${slots.filter(Boolean).length} of ${regularQty} packs marked special`}
        </p>
      ) : null}
    </div>
  );
}
