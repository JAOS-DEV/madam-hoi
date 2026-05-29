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
import { getAdminErrorMessage } from "./adminToastErrors";
import { updateOrderingStatus, updateSettingsPatch } from "./adminService";

type SupportedDeliveryTemplate = "estimated_range" | "starts_after" | "varies";

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
  if (template === "starts_after" || template === "varies") {
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
  const [announcementTh, setAnnouncementTh] = useState(settings.announcementTh ?? settings.announcement ?? "");
  const [announcementEn, setAnnouncementEn] = useState(settings.announcementEn ?? settings.announcement ?? "");
  const [template, setTemplate] = useState<SupportedDeliveryTemplate>(
    normalizeTemplate(settings.deliveryMessage.template),
  );
  const [startTime, setStartTime] = useState(settings.deliveryMessage.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(settings.deliveryMessage.endTime ?? "22:00");
  const [dispatchAddress, setDispatchAddress] = useState(settings.dispatchPoint?.address ?? "");
  const [dispatchLat, setDispatchLat] = useState(
    settings.dispatchPoint?.lat !== undefined ? String(settings.dispatchPoint.lat) : "",
  );
  const [dispatchLng, setDispatchLng] = useState(
    settings.dispatchPoint?.lng !== undefined ? String(settings.dispatchPoint.lng) : "",
  );
  const [isDispatchPickerOpen, setIsDispatchPickerOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [orderingAction, setOrderingAction] = useState<"open" | "close" | null>(null);

  const handleSave = async (): Promise<void> => {
    setIsSavingSettings(true);
    try {
      await updateSettingsPatch({
        announcement: (announcementEn || announcementTh || settings.announcement).trim(),
        announcementTh: announcementTh.trim(),
        announcementEn: announcementEn.trim(),
        deliveryMessage: {
          template,
          startTime,
          endTime,
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

  const handleOrderingStatus = async (open: boolean): Promise<void> => {
    setOrderingAction(open ? "open" : "close");
    try {
      await updateOrderingStatus(open);
      onToast(open ? t.toastOrderingOpened : t.toastOrderingClosed, "success");
    } catch (error) {
      onToast(getAdminErrorMessage(error, t), "error");
    } finally {
      setOrderingAction(null);
    }
  };

  return (
    <Card title={t.adminSettingsPanelTitle} collapsible collapseStorageKey="admin.section.settings">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant={settings.orderingOpen ? "primary" : "secondary"}
            onClick={() => void handleOrderingStatus(true)}
            disabled={orderingAction !== null}
            aria-busy={orderingAction === "open"}
          >
            {orderingAction === "open" ? (
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
            ) : null}
            {t.openOrdering}
          </Button>
          <Button
            variant={!settings.orderingOpen ? "danger" : "secondary"}
            onClick={() => void handleOrderingStatus(false)}
            disabled={orderingAction !== null}
            aria-busy={orderingAction === "close"}
          >
            {orderingAction === "close" ? (
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-middle" />
            ) : null}
            {t.closeOrdering}
          </Button>
        </div>
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
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t.startTimeLabel} value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <Input label={t.endTimeLabel} value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </div>
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
            {dispatchLat && dispatchLng ? `Lat ${dispatchLat}, Lng ${dispatchLng}` : ""}
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
          setDispatchLat(lat.toFixed(6));
          setDispatchLng(lng.toFixed(6));
          setIsDispatchPickerOpen(false);
        }}
      />
    </Card>
  );
}
