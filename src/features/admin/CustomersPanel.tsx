import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { MapPinPicker } from "../../components/ui/MapPinPicker";
import type { ToastTone } from "../../hooks/useToast";
import { translations, type Language } from "../../i18n";
import type { CustomerProfileDoc } from "../../types/firestore";
import { formatDateTime } from "../../utils/dates";
import { parseOptionalNumber } from "../../utils/firestore";
import { reverseGeocodeAddress } from "../../utils/geocoding";
import { createCustomerProfile, deleteCustomerProfile, updateCustomerProfile } from "./adminService";

interface CustomersPanelProps {
  customers: CustomerProfileDoc[];
  language: Language;
  onToast: (message: string, tone: ToastTone) => void;
}

interface CustomerDraft {
  name: string;
  phone: string;
  email: string;
  defaultDeliveryLocation: string;
  locationLat: string;
  locationLng: string;
  notes: string;
}

type MapPinTarget = { type: "new" } | { type: "edit"; customerId: string } | null;

const emptyCustomerDraft: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  defaultDeliveryLocation: "",
  locationLat: "",
  locationLng: "",
  notes: "",
};
const phonePattern = /^[0-9+\-\s()]+$/;
const CREATE_CUSTOMER_DRAFT_KEY = "madam-hoi.admin-create-customer-draft";
const EDIT_CUSTOMER_DRAFTS_KEY = "madam-hoi.admin-edit-customer-drafts";

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue<T>(key: string, value: T): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures; the form still works without draft persistence.
  }
}

function removeStoredValue(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function hasDraftContent(draft: CustomerDraft): boolean {
  return Object.values(draft).some((value) => value.trim().length > 0);
}

function toCustomerDraft(customer: CustomerProfileDoc): CustomerDraft {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    defaultDeliveryLocation: customer.defaultDeliveryLocation ?? "",
    locationLat: customer.defaultLocation?.lat !== undefined ? String(customer.defaultLocation.lat) : "",
    locationLng: customer.defaultLocation?.lng !== undefined ? String(customer.defaultLocation.lng) : "",
    notes: customer.notes ?? "",
  };
}

function getDraftLocation(draft: CustomerDraft): { lat: number; lng: number } | null {
  const lat = parseOptionalNumber(draft.locationLat);
  const lng = parseOptionalNumber(draft.locationLng);
  if (lat === undefined || lng === undefined) {
    return null;
  }
  return { lat, lng };
}

function hasPartialPin(draft: CustomerDraft): boolean {
  const hasLat = draft.locationLat.trim().length > 0;
  const hasLng = draft.locationLng.trim().length > 0;
  return (hasLat || hasLng) && getDraftLocation(draft) === null;
}

function getPinStatusText(draft: CustomerDraft, language: Language, isResolvingPinAddress: boolean): string {
  const location = getDraftLocation(draft);
  if (isResolvingPinAddress) {
    return language === "th" ? "กำลังอัปเดตที่อยู่จากพิน..." : "Updating address from pin...";
  }
  if (location) {
    return language === "th"
      ? `ปักหมุดแล้ว (${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}) — ปรับบนแผนที่ได้`
      : `Pin set (${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}) — fine-tune on map if needed`;
  }
  return language === "th"
    ? "เลือกหมุดบนแผนที่เพื่อบันทึกตำแหน่งจัดส่งเริ่มต้น"
    : "Choose a pin on the map to save the default delivery spot.";
}

export function CustomersPanel({ customers, language, onToast }: CustomersPanelProps): JSX.Element {
  const t = useMemo(() => translations[language], [language]);
  const [search, setSearch] = useState("");
  const [createDraft, setCreateDraft] = useState<CustomerDraft>(() =>
    readStoredValue(CREATE_CUSTOMER_DRAFT_KEY, emptyCustomerDraft),
  );
  const [editingById, setEditingById] = useState<Record<string, CustomerDraft>>(() =>
    readStoredValue(EDIT_CUSTOMER_DRAFTS_KEY, {}),
  );
  const [isCreating, setIsCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mapPinTarget, setMapPinTarget] = useState<MapPinTarget>(null);
  const [isResolvingPinAddress, setIsResolvingPinAddress] = useState(false);

  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return customers;
    }
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone} ${customer.email ?? ""} ${customer.defaultDeliveryLocation ?? ""} ${customer.notes ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [customers, search]);

  useEffect(() => {
    if (hasDraftContent(createDraft)) {
      writeStoredValue(CREATE_CUSTOMER_DRAFT_KEY, createDraft);
      return;
    }
    removeStoredValue(CREATE_CUSTOMER_DRAFT_KEY);
  }, [createDraft]);

  useEffect(() => {
    if (Object.keys(editingById).length > 0) {
      writeStoredValue(EDIT_CUSTOMER_DRAFTS_KEY, editingById);
      return;
    }
    removeStoredValue(EDIT_CUSTOMER_DRAFTS_KEY);
  }, [editingById]);

  const updateDraft = (customerId: string, patch: Partial<CustomerDraft>): void => {
    setEditingById((prev) => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        ...patch,
      },
    }));
  };

  const updateCreateDraft = (patch: Partial<CustomerDraft>): void => {
    setCreateDraft((prev) => ({ ...prev, ...patch }));
  };

  const getValidationError = (draft: CustomerDraft): string | null => {
    if (!draft.name.trim() || !draft.phone.trim()) {
      return language === "th" ? "กรุณากรอกชื่อลูกค้าและเบอร์โทร" : "Please enter customer name and phone.";
    }
    if (draft.phone.trim().length < 8 || !phonePattern.test(draft.phone.trim())) {
      return language === "th" ? "กรุณากรอกเบอร์โทรให้ถูกต้อง" : "Please enter a valid phone number.";
    }
    if (hasPartialPin(draft)) {
      return language === "th"
        ? "กรุณากรอกละติจูดและลองจิจูดให้ครบ หรือเลือกหมุดบนแผนที่"
        : "Please enter both latitude and longitude, or choose a pin on the map.";
    }
    return null;
  };

  const getCreateValidationError = (draft: CustomerDraft): string | null => {
    const baseError = getValidationError(draft);
    if (baseError) {
      return baseError;
    }
    if (!draft.defaultDeliveryLocation.trim()) {
      return language === "th" ? "กรุณากรอกสถานที่จัดส่ง" : "Please enter a delivery location.";
    }
    if (!getDraftLocation(draft)) {
      return language === "th"
        ? "กรุณาเลือกหมุดบนแผนที่ก่อนเพิ่มลูกค้า"
        : "Please choose a map pin before adding the customer.";
    }
    return null;
  };

  const handleCreate = async (): Promise<void> => {
    const validationError = getCreateValidationError(createDraft);
    if (validationError) {
      onToast(validationError, "error");
      return;
    }
    setIsCreating(true);
    try {
      await createCustomerProfile({
        name: createDraft.name.trim(),
        phone: createDraft.phone.trim(),
        email: createDraft.email.trim(),
        defaultDeliveryLocation: createDraft.defaultDeliveryLocation.trim(),
        defaultLocation: getDraftLocation(createDraft) ?? undefined,
        notes: createDraft.notes.trim(),
      });
      setCreateDraft(emptyCustomerDraft);
      removeStoredValue(CREATE_CUSTOMER_DRAFT_KEY);
      onToast(language === "th" ? "เพิ่มลูกค้าแล้ว" : "Customer added.", "success");
    } catch {
      onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const cancelEdit = (customerId: string): void => {
    setEditingById((prev) => {
      const next = { ...prev };
      delete next[customerId];
      return next;
    });
  };

  const handleSave = async (customerId: string): Promise<void> => {
    const draft = editingById[customerId];
    if (!draft) {
      return;
    }
    const validationError = getValidationError(draft);
    if (validationError) {
      onToast(validationError, "error");
      return;
    }
    setSavingId(customerId);
    try {
      const defaultLocation =
        draft.locationLat.trim() || draft.locationLng.trim() ? getDraftLocation(draft) : null;
      await updateCustomerProfile(customerId, {
        name: draft.name.trim(),
        phone: draft.phone.trim(),
        email: draft.email.trim(),
        defaultDeliveryLocation: draft.defaultDeliveryLocation.trim(),
        defaultLocation,
        notes: draft.notes.trim(),
      });
      cancelEdit(customerId);
      onToast(language === "th" ? "บันทึกลูกค้าแล้ว" : "Customer saved.", "success");
    } catch {
      onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (customer: CustomerProfileDoc): Promise<void> => {
    const confirmed = window.confirm(
      language === "th" ? `ลบลูกค้า ${customer.name}?` : `Delete customer ${customer.name}?`,
    );
    if (!confirmed) {
      return;
    }
    setDeletingId(customer.id);
    try {
      await deleteCustomerProfile(customer.id);
      cancelEdit(customer.id);
      onToast(language === "th" ? "ลบลูกค้าแล้ว" : "Customer deleted.", "success");
    } catch {
      onToast(language === "th" ? "เกิดข้อผิดพลาด" : "Something went wrong.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const applyPinToTarget = (target: MapPinTarget, patch: Partial<CustomerDraft>): void => {
    if (!target) {
      return;
    }
    if (target.type === "new") {
      updateCreateDraft(patch);
      return;
    }
    updateDraft(target.customerId, patch);
  };

  const handleMapPinConfirm = async (lat: number, lng: number): Promise<void> => {
    const target = mapPinTarget;
    setMapPinTarget(null);
    applyPinToTarget(target, {
      locationLat: lat.toFixed(6),
      locationLng: lng.toFixed(6),
    });
    setIsResolvingPinAddress(true);
    try {
      const address = await reverseGeocodeAddress(lat, lng);
      if (address) {
        applyPinToTarget(target, { defaultDeliveryLocation: address });
        onToast(
          language === "th" ? "อัปเดตที่อยู่จากพินแล้ว" : "Address filled from pin.",
          "success",
        );
      }
    } catch {
      onToast(
        language === "th"
          ? "ค้นหาที่อยู่ไม่สำเร็จ กรุณากรอกสถานที่จัดส่งเอง"
          : "Could not look up the address. Please enter it manually.",
        "error",
      );
    } finally {
      setIsResolvingPinAddress(false);
    }
  };

  const mapInitialDraft =
    mapPinTarget?.type === "new" ? createDraft : mapPinTarget ? editingById[mapPinTarget.customerId] : undefined;
  const mapInitialLocation = mapInitialDraft ? getDraftLocation(mapInitialDraft) : null;
  const createPinStatusText = getPinStatusText(createDraft, language, isResolvingPinAddress);

  return (
    <>
      <Card
        title={language === "th" ? "เพิ่มลูกค้าใหม่" : "Add new customer"}
        collapsible
        collapseStorageKey="admin.customers.new-customer"
        defaultCollapsed
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            {language === "th"
              ? "เพิ่มลูกค้าไว้ล่วงหน้าได้โดยไม่ต้องสร้างออเดอร์ พร้อมบันทึกหมุดจัดส่งเริ่มต้น"
              : "Add customers before they order, including their default delivery pin."}
          </p>
          <Input
            label={language === "th" ? "ชื่อลูกค้า" : "Customer name"}
            value={createDraft.name}
            onChange={(event) => updateCreateDraft({ name: event.target.value })}
          />
          <Input
            label={language === "th" ? "เบอร์โทร" : "Phone"}
            value={createDraft.phone}
            onChange={(event) => updateCreateDraft({ phone: event.target.value })}
          />
          <Input
            label={`${t.email} (${t.optional})`}
            value={createDraft.email}
            onChange={(event) => updateCreateDraft({ email: event.target.value })}
          />
          <div className="space-y-1">
            <Input
              label={t.deliveryLocation}
              value={createDraft.defaultDeliveryLocation}
              onChange={(event) => updateCreateDraft({ defaultDeliveryLocation: event.target.value })}
            />
            <p className="text-xs text-slate-600">
              {language === "th"
                ? "กรอกที่อยู่ก่อน แล้วเลือกหมุดบนแผนที่ให้ตรงจุดจัดส่ง"
                : "Enter the address first, then choose the map pin for the delivery spot."}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-600">{createPinStatusText}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMapPinTarget({ type: "new" })}
              fullWidth
            >
              {language === "th" ? "ปรับหมุดบนแผนที่" : "Fine-tune pin on map"}
            </Button>
          </div>
          <Input
            label={language === "th" ? "โน้ต" : "Notes"}
            value={createDraft.notes}
            onChange={(event) => updateCreateDraft({ notes: event.target.value })}
          />
          <Button onClick={() => void handleCreate()} disabled={isCreating} fullWidth>
            {isCreating
              ? language === "th"
                ? "กำลังเพิ่ม..."
                : "Adding..."
              : language === "th"
                ? "เพิ่มลูกค้า"
                : "Add customer"}
          </Button>
        </div>
      </Card>

      <Card
        title={language === "th" ? "ลูกค้า" : "Customers"}
        collapsible
        collapseStorageKey="admin.section.customers"
        defaultCollapsed
      >
      <div className="space-y-3">
        <Input
          label={language === "th" ? "ค้นหาลูกค้า" : "Search customers"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={language === "th" ? "ชื่อ เบอร์โทร ที่อยู่ หรือโน้ต" : "Name, phone, address, or notes"}
        />
        <p className="text-xs text-slate-600">
          {language === "th"
            ? "ลูกค้าเหล่านี้ถูกเพิ่มจากหน้านี้หรือบันทึกจากออเดอร์ที่แอดมินกรอกเอง"
            : "These customers are added here or saved from admin-entered orders."}
        </p>

        <div className="space-y-3">
          {visibleCustomers.map((customer) => {
            const draft = editingById[customer.id];
            return (
              <article key={customer.id} className="rounded-lg border border-brand-gold/30 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-redDark">{customer.name}</p>
                    <p className="text-sm text-slate-700">{customer.phone}</p>
                    {customer.defaultDeliveryLocation ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{customer.defaultDeliveryLocation}</p>
                    ) : null}
                    {customer.defaultLocation ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {language === "th" ? "หมุด" : "Pin"}: {customer.defaultLocation.lat.toFixed(5)},{" "}
                        {customer.defaultLocation.lng.toFixed(5)}
                      </p>
                    ) : null}
                    {customer.lastOrderAt ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {language === "th" ? "ออเดอร์ล่าสุด" : "Last order"}: {formatDateTime(customer.lastOrderAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {draft ? (
                      <Button size="compact" variant="secondary" onClick={() => cancelEdit(customer.id)}>
                        {language === "th" ? "ยกเลิก" : "Cancel"}
                      </Button>
                    ) : (
                      <Button
                        size="compact"
                        variant="secondary"
                        onClick={() => setEditingById((prev) => ({ ...prev, [customer.id]: toCustomerDraft(customer) }))}
                      >
                        {language === "th" ? "แก้ไข" : "Edit"}
                      </Button>
                    )}
                    <Button
                      size="compact"
                      variant="danger"
                      onClick={() => void handleDelete(customer)}
                      disabled={deletingId === customer.id}
                    >
                      {deletingId === customer.id
                        ? language === "th"
                          ? "กำลังลบ..."
                          : "Deleting..."
                        : language === "th"
                          ? "ลบ"
                          : "Delete"}
                    </Button>
                  </div>
                </div>

                {draft ? (
                  <div className="mt-3 space-y-3 border-t border-brand-gold/30 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={language === "th" ? "ชื่อลูกค้า" : "Customer name"}
                        value={draft.name}
                        onChange={(event) => updateDraft(customer.id, { name: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "เบอร์โทร" : "Phone"}
                        value={draft.phone}
                        onChange={(event) => updateDraft(customer.id, { phone: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "อีเมล" : "Email"}
                        value={draft.email}
                        onChange={(event) => updateDraft(customer.id, { email: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "สถานที่จัดส่งเริ่มต้น" : "Default delivery location"}
                        value={draft.defaultDeliveryLocation}
                        onChange={(event) => updateDraft(customer.id, { defaultDeliveryLocation: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "ละติจูดหมุด" : "Pin latitude"}
                        value={draft.locationLat}
                        onChange={(event) => updateDraft(customer.id, { locationLat: event.target.value })}
                      />
                      <Input
                        label={language === "th" ? "ลองจิจูดหมุด" : "Pin longitude"}
                        value={draft.locationLng}
                        onChange={(event) => updateDraft(customer.id, { locationLng: event.target.value })}
                      />
                    </div>
                    <Input
                      label={language === "th" ? "โน้ต" : "Notes"}
                      value={draft.notes}
                      onChange={(event) => updateDraft(customer.id, { notes: event.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="compact"
                        variant="secondary"
                        onClick={() => setMapPinTarget({ type: "edit", customerId: customer.id })}
                      >
                        {language === "th" ? "เลือกหมุดบนแผนที่" : "Choose pin on map"}
                      </Button>
                      <Button
                        size="compact"
                        onClick={() => void handleSave(customer.id)}
                        disabled={savingId === customer.id}
                      >
                        {savingId === customer.id
                          ? language === "th"
                            ? "กำลังบันทึก..."
                            : "Saving..."
                          : language === "th"
                            ? "บันทึก"
                            : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          {visibleCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">
              {language === "th" ? "ยังไม่มีลูกค้าที่บันทึกไว้" : "No saved customers yet."}
            </p>
          ) : null}
        </div>
      </div>
      </Card>
      <MapPinPicker
        isOpen={mapPinTarget !== null}
        title={language === "th" ? "เลือกหมุดลูกค้า" : "Choose customer pin"}
        t={t}
        initialLat={mapInitialLocation?.lat}
        initialLng={mapInitialLocation?.lng}
        onClose={() => setMapPinTarget(null)}
        onConfirm={(lat, lng) => {
          void handleMapPinConfirm(lat, lng);
        }}
      />
    </>
  );
}
