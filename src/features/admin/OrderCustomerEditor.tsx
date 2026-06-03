import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import type { Language, Translation } from "../../i18n";
import type { OrderDoc } from "../../types/firestore";
import { forwardGeocodeAddress } from "../../utils/geocoding";

export interface OrderCustomerDetailsPatch {
  name: string;
  phone: string;
  email: string;
  deliveryLocation: string;
  notes: string;
  location?: { lat: number; lng: number };
}

interface OrderCustomerEditorProps {
  order: OrderDoc & { id: string };
  language: Language;
  t: Translation;
  canEdit: boolean;
  isSaving: boolean;
  isResolvingPin: boolean;
  onSave: (patch: OrderCustomerDetailsPatch) => Promise<void>;
  onPickPin: () => void;
  onCopy: (value: string, label: string) => void;
  onEditingChange?: (editing: boolean) => void;
}

interface CustomerDraft {
  name: string;
  phone: string;
  email: string;
  deliveryLocation: string;
  notes: string;
  lat?: number;
  lng?: number;
}

function toCustomerDraft(order: OrderDoc): CustomerDraft {
  return {
    name: order.customer.name,
    phone: order.customer.phone,
    email: order.customer.email ?? "",
    deliveryLocation: order.customer.deliveryLocation,
    notes: order.customer.notes ?? "",
    lat: order.customer.location?.lat,
    lng: order.customer.location?.lng,
  };
}

export function OrderCustomerEditor({
  order,
  language,
  t,
  canEdit,
  isSaving,
  isResolvingPin,
  onSave,
  onPickPin,
  onCopy,
  onEditingChange,
}: OrderCustomerEditorProps): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CustomerDraft>(() => toCustomerDraft(order));
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [addressGeocodeFailed, setAddressGeocodeFailed] = useState(false);
  const skipAddressGeocodeRef = useRef(false);
  const lastGeocodedQueryRef = useRef("");

  useEffect(() => {
    setDraft(toCustomerDraft(order));
    lastGeocodedQueryRef.current = order.customer.deliveryLocation.trim();
    setAddressGeocodeFailed(false);
    setIsEditing(false);
  }, [order]);

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  const hasMapPin = Number.isFinite(draft.lat) && Number.isFinite(draft.lng);

  useEffect(() => {
    if (!canEdit || !isEditing) {
      return;
    }
    const query = draft.deliveryLocation.trim();
    if (skipAddressGeocodeRef.current) {
      skipAddressGeocodeRef.current = false;
      return;
    }
    if (query.length < 8) {
      setAddressGeocodeFailed(false);
      return;
    }
    if (query === lastGeocodedQueryRef.current && hasMapPin) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        if (query !== lastGeocodedQueryRef.current) {
          setDraft((prev) => ({ ...prev, lat: undefined, lng: undefined }));
        }
        setIsGeocodingAddress(true);
        setAddressGeocodeFailed(false);
        try {
          const result = await forwardGeocodeAddress(query, controller.signal);
          if (controller.signal.aborted) {
            return;
          }
          if (result) {
            lastGeocodedQueryRef.current = query;
            setDraft((prev) => ({ ...prev, lat: result.lat, lng: result.lng }));
            setAddressGeocodeFailed(false);
          } else {
            setAddressGeocodeFailed(true);
          }
        } catch {
          if (!controller.signal.aborted) {
            setAddressGeocodeFailed(true);
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsGeocodingAddress(false);
          }
        }
      })();
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [canEdit, draft.deliveryLocation, hasMapPin, isEditing]);

  const openMaps = (): void => {
    const destination = hasMapPin ? `${draft.lat},${draft.lng}` : order.customer.deliveryLocation.trim();
    if (!destination) {
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const startEditing = (): void => {
    setDraft(toCustomerDraft(order));
    lastGeocodedQueryRef.current = order.customer.deliveryLocation.trim();
    setAddressGeocodeFailed(false);
    setIsEditing(true);
  };

  const cancelEditing = (): void => {
    setDraft(toCustomerDraft(order));
    setAddressGeocodeFailed(false);
    setIsEditing(false);
  };

  const handleSave = (): void => {
    void (async () => {
      await onSave({
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        deliveryLocation: draft.deliveryLocation,
        notes: draft.notes,
        location:
          Number.isFinite(draft.lat) && Number.isFinite(draft.lng)
            ? { lat: draft.lat as number, lng: draft.lng as number }
            : undefined,
      });
      setIsEditing(false);
    })();
  };

  const pinStatusText = ((): string | null => {
    if (!isEditing) {
      return null;
    }
    if (isGeocodingAddress) {
      return language === "th" ? "กำลังค้นหาตำแหน่งจากที่อยู่..." : "Finding location from address...";
    }
    if (addressGeocodeFailed) {
      return language === "th"
        ? "ไม่พบตำแหน่งจากที่อยู่ — ใช้ปุ่มปักหมุดบนแผนที่"
        : "Address not found — use pin on map.";
    }
    return null;
  })();

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {language === "th" ? "ติดต่อและจัดส่ง" : "Contact & delivery"}
      </p>

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <Input
            label={language === "th" ? "ชื่อลูกค้า" : "Customer name"}
            value={draft.name}
            disabled={isSaving}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            label={language === "th" ? "เบอร์โทร" : "Phone"}
            value={draft.phone}
            disabled={isSaving}
            onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
          />
          <Input
            label={`${language === "th" ? "อีเมล" : "Email"} (${t.optional})`}
            value={draft.email}
            disabled={isSaving}
            onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            label={t.deliveryLocation}
            value={draft.deliveryLocation}
            disabled={isSaving}
            onChange={(event) => setDraft((prev) => ({ ...prev, deliveryLocation: event.target.value }))}
          />
          <Input
            label={`${t.notes} (${t.optional})`}
            value={draft.notes}
            disabled={isSaving}
            onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
          />
          {pinStatusText ? <p className="text-xs text-slate-600">{pinStatusText}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="compact" variant="secondary" fullWidth onClick={cancelEditing} disabled={isSaving}>
              {language === "th" ? "ยกเลิก" : "Cancel"}
            </Button>
            <Button type="button" size="compact" fullWidth onClick={handleSave} disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
              ) : null}
              {language === "th" ? "บันทึก" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          type="button"
          fullWidth
          size="compact"
          variant="secondary"
          onClick={() => window.open(`tel:${order.customer.phone}`)}
        >
          {language === "th" ? "โทรลูกค้า" : "Call customer"}
        </Button>
        <Button
          type="button"
          fullWidth
          size="compact"
          variant="secondary"
          onClick={() => onCopy(order.customer.phone, language === "th" ? "เบอร์โทร" : "Phone")}
        >
          {language === "th" ? "คัดลอกเบอร์" : "Copy phone"}
        </Button>
        <Button
          type="button"
          fullWidth
          size="compact"
          variant="secondary"
          onClick={() => onCopy(order.customer.deliveryLocation, language === "th" ? "ที่อยู่" : "Address")}
        >
          {language === "th" ? "คัดลอกที่อยู่" : "Copy address"}
        </Button>
        <Button type="button" fullWidth size="compact" variant="secondary" onClick={openMaps}>
          {language === "th" ? "เปิดแผนที่" : "Open map"}
        </Button>
        <div className={canEdit && !isEditing ? undefined : "col-span-2"}>
          <Button
            type="button"
            fullWidth
            size="compact"
            variant="secondary"
            onClick={onPickPin}
            disabled={isSaving || isResolvingPin}
          >
            {isResolvingPin
              ? language === "th"
                ? "กำลังค้นหาที่อยู่..."
                : "Looking up address..."
              : t.pickPinOnMap}
          </Button>
        </div>
        {canEdit && !isEditing ? (
          <Button
            type="button"
            fullWidth
            size="compact"
            variant="secondary"
            onClick={startEditing}
            disabled={isSaving || isResolvingPin}
          >
            {language === "th" ? "แก้ไขข้อมูล" : "Edit details"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
