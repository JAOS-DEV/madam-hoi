import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { MapPinPicker } from "../../components/ui/MapPinPicker";
import { Select } from "../../components/ui/Select";
import type { ToastTone } from "../../hooks/useToast";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc } from "../../types/firestore";
import { parseOptionalNumber } from "../../utils/firestore";
import { reverseGeocodeAddress } from "../../utils/geocoding";
import { getAdminErrorMessage } from "./adminToastErrors";
import { updateSettingsPatch } from "./adminService";

type SupportedDeliveryTemplate = "estimated_range" | "starts_after" | "varies" | "custom";

function buildDispatchPoint(
  address: string,
  latValue: string,
  lngValue: string,
): NonNullable<MainSettingsDoc["dispatchPoint"]> {
  const dispatchPoint: NonNullable<MainSettingsDoc["dispatchPoint"]> = { address };
  const lat = parseOptionalNumber(latValue);
  const lng = parseOptionalNumber(lngValue);
  if (lat !== undefined) {
    dispatchPoint.lat = lat;
  }
  if (lng !== undefined) {
    dispatchPoint.lng = lng;
  }
  return dispatchPoint;
}

function normalizeTemplate(
  template: MainSettingsDoc["deliveryMessage"]["template"],
): SupportedDeliveryTemplate {
  if (template === "starts_after" || template === "varies" || template === "custom") {
    return template;
  }
  return "estimated_range";
}

interface SettingsPanelProps {
  settings: MainSettingsDoc;
  t: Translation;
  onToast: (message: string, tone: ToastTone) => void;
}

export function SettingsPanel({ settings, t, onToast }: SettingsPanelProps): JSX.Element {
  const [phoneNumber, setPhoneNumber] = useState(settings.phoneNumber);
  const [lineUrl, setLineUrl] = useState(settings.lineUrl ?? "");
  const [announcementTh, setAnnouncementTh] = useState(settings.announcementTh ?? settings.announcement ?? "");
  const [announcementEn, setAnnouncementEn] = useState(settings.announcementEn ?? settings.announcement ?? "");
  const [template, setTemplate] = useState<SupportedDeliveryTemplate>(
    normalizeTemplate(settings.deliveryMessage.template),
  );
  const [startTime, setStartTime] = useState(settings.deliveryMessage.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(settings.deliveryMessage.endTime ?? "22:00");
  const [customMessageTh, setCustomMessageTh] = useState(settings.deliveryMessage.customMessageTh ?? "");
  const [customMessageEn, setCustomMessageEn] = useState(settings.deliveryMessage.customMessageEn ?? "");
  const [dispatchAddress, setDispatchAddress] = useState(settings.dispatchPoint?.address ?? "");
  const [dispatchLat, setDispatchLat] = useState(
    settings.dispatchPoint?.lat !== undefined ? String(settings.dispatchPoint.lat) : "",
  );
  const [dispatchLng, setDispatchLng] = useState(
    settings.dispatchPoint?.lng !== undefined ? String(settings.dispatchPoint.lng) : "",
  );
  const [isDispatchPickerOpen, setIsDispatchPickerOpen] = useState(false);
  const [isResolvingDispatchAddress, setIsResolvingDispatchAddress] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSave = async (): Promise<void> => {
    setIsSavingSettings(true);
    try {
      await updateSettingsPatch({
        phoneNumber: phoneNumber.trim(),
        lineUrl: lineUrl.trim(),
        announcement: (announcementEn || announcementTh || settings.announcement).trim(),
        announcementTh: announcementTh.trim(),
        announcementEn: announcementEn.trim(),
        deliveryMessage: {
          template,
          startTime,
          endTime,
          customMessageTh: customMessageTh.trim(),
          customMessageEn: customMessageEn.trim(),
        },
        dispatchPoint: buildDispatchPoint(dispatchAddress, dispatchLat, dispatchLng),
      });
      onToast(t.toastSettingsSaved, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDispatchPinConfirm = async (lat: number, lng: number): Promise<void> => {
    setDispatchLat(lat.toFixed(6));
    setDispatchLng(lng.toFixed(6));
    setIsDispatchPickerOpen(false);
    setIsResolvingDispatchAddress(true);
    try {
      const address = await reverseGeocodeAddress(lat, lng);
      if (address) {
        setDispatchAddress(address);
        onToast(
          t.languageToggle === "EN" ? "อัปเดตที่อยู่จากพินแล้ว" : "Dispatch address filled from pin.",
          "success",
        );
      } else {
        onToast(
          t.languageToggle === "EN"
            ? "ไม่พบที่อยู่จากพินนี้ กรุณากรอกที่อยู่เอง"
            : "No address found for this pin. Please enter it manually.",
          "error",
        );
      }
    } catch {
      onToast(
        t.languageToggle === "EN"
          ? "ค้นหาที่อยู่ไม่สำเร็จ กรุณากรอกที่อยู่เอง"
          : "Could not look up the address. Please enter it manually.",
        "error",
      );
    } finally {
      setIsResolvingDispatchAddress(false);
    }
  };

  return (
    <Card
      title={t.languageToggle === "EN" ? "ธุรกิจและข้อความจัดส่ง" : "Business and delivery setup"}
      collapsible
      collapseStorageKey="admin.section.settings"
    >
      <div className="space-y-3">
        <Input
          label={t.languageToggle === "EN" ? "เบอร์โทรธุรกิจ" : "Business phone"}
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
        />
        <Input
          label="LINE URL"
          value={lineUrl}
          onChange={(event) => setLineUrl(event.target.value)}
        />
        <Input
          label={t.announcementThaiLabel}
          value={announcementTh}
          onChange={(event) => setAnnouncementTh(event.target.value)}
        />
        <Input
          label={t.announcementEnglishLabel}
          value={announcementEn}
          onChange={(event) => setAnnouncementEn(event.target.value)}
        />
        <Select
          label={t.deliveryTemplateLabel}
          value={template}
          onChange={(event) => setTemplate(event.target.value as SupportedDeliveryTemplate)}
          options={[
            { value: "estimated_range", label: t.templateEstimatedRange },
            { value: "starts_after", label: t.templateStartsAfter },
            { value: "varies", label: t.templateVaries },
            { value: "custom", label: t.templateCustom },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t.startTimeLabel} value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <Input label={t.endTimeLabel} value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </div>
        {template === "custom" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t.customThaiMessage}
              value={customMessageTh}
              onChange={(event) => setCustomMessageTh(event.target.value)}
            />
            <Input
              label={t.customEnglishMessage}
              value={customMessageEn}
              onChange={(event) => setCustomMessageEn(event.target.value)}
            />
          </div>
        ) : null}
        <Input
          label={t.dispatchStartPointLabel}
          value={dispatchAddress}
          onChange={(event) => setDispatchAddress(event.target.value)}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsDispatchPickerOpen(true)}>
            {t.pickPinOnMap}
          </Button>
          <span className="text-xs text-slate-600">
            {isResolvingDispatchAddress
              ? t.languageToggle === "EN"
                ? "กำลังค้นหาที่อยู่..."
                : "Looking up address..."
              : dispatchLat && dispatchLng
                ? `Lat ${dispatchLat}, Lng ${dispatchLng}`
                : ""}
          </span>
        </div>
        <p className="text-xs text-slate-600">{t.routingSettingsHint}</p>
        <Button onClick={() => void handleSave()} disabled={isSavingSettings} aria-busy={isSavingSettings}>
          {isSavingSettings ? (
            <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
          ) : null}
          {t.saveSettings}
        </Button>
      </div>
      <MapPinPicker
        isOpen={isDispatchPickerOpen}
        title={t.dispatchStartPointLabel}
        initialLat={dispatchLat.trim() ? Number(dispatchLat) : undefined}
        initialLng={dispatchLng.trim() ? Number(dispatchLng) : undefined}
        onClose={() => setIsDispatchPickerOpen(false)}
        onConfirm={(lat, lng) => {
          void handleDispatchPinConfirm(lat, lng);
        }}
      />
    </Card>
  );
}
