import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { MapPinPicker } from "../../components/ui/MapPinPicker";
import { Select } from "../../components/ui/Select";
import type { Translation } from "../../i18n";
import type { MainSettingsDoc } from "../../types/firestore";
import { updateOrderingStatus, updateSettingsPatch } from "./adminService";

interface SettingsPanelProps {
  settings: MainSettingsDoc;
  t: Translation;
}

export function SettingsPanel({ settings, t }: SettingsPanelProps): JSX.Element {
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [template, setTemplate] = useState(settings.deliveryMessage.template);
  const [startTime, setStartTime] = useState(settings.deliveryMessage.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(settings.deliveryMessage.endTime ?? "22:00");
  const [customTh, setCustomTh] = useState(settings.deliveryMessage.customMessageTh ?? "");
  const [customEn, setCustomEn] = useState(settings.deliveryMessage.customMessageEn ?? "");
  const [dispatchAddress, setDispatchAddress] = useState(settings.dispatchPoint?.address ?? "");
  const [dispatchLat, setDispatchLat] = useState(
    settings.dispatchPoint?.lat !== undefined ? String(settings.dispatchPoint.lat) : "",
  );
  const [dispatchLng, setDispatchLng] = useState(
    settings.dispatchPoint?.lng !== undefined ? String(settings.dispatchPoint.lng) : "",
  );
  const [isDispatchPickerOpen, setIsDispatchPickerOpen] = useState(false);

  const handleSave = async (): Promise<void> => {
    await updateSettingsPatch({
      announcement,
      deliveryMessage: {
        template,
        startTime,
        endTime,
        customMessageTh: customTh,
        customMessageEn: customEn,
      },
      dispatchPoint: {
        address: dispatchAddress,
        lat: dispatchLat.trim() ? Number(dispatchLat) : undefined,
        lng: dispatchLng.trim() ? Number(dispatchLng) : undefined,
      },
    });
  };

  return (
    <Card title={t.adminSettingsPanelTitle}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant={settings.orderingOpen ? "primary" : "secondary"}
            onClick={() => updateOrderingStatus(true)}
          >
            {t.openOrdering}
          </Button>
          <Button
            variant={!settings.orderingOpen ? "danger" : "secondary"}
            onClick={() => updateOrderingStatus(false)}
          >
            {t.closeOrdering}
          </Button>
        </div>
        <Input
          label={t.announcementLabel}
          value={announcement}
          onChange={(event) => setAnnouncement(event.target.value)}
        />
        <Select
          label={t.deliveryTemplateLabel}
          value={template}
          onChange={(event) => setTemplate(event.target.value as MainSettingsDoc["deliveryMessage"]["template"])}
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
        <Input label={t.customThaiMessage} value={customTh} onChange={(event) => setCustomTh(event.target.value)} />
        <Input label={t.customEnglishMessage} value={customEn} onChange={(event) => setCustomEn(event.target.value)} />
        <Input
          label={t.dispatchStartPointLabel}
          value={dispatchAddress}
          onChange={(event) => setDispatchAddress(event.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t.dispatchLatLabel}
            value={dispatchLat}
            onChange={(event) => setDispatchLat(event.target.value)}
          />
          <Input
            label={t.dispatchLngLabel}
            value={dispatchLng}
            onChange={(event) => setDispatchLng(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setIsDispatchPickerOpen(true)}>
            {t.pickPinOnMap}
          </Button>
          <span className="text-xs text-slate-600">
            {dispatchLat && dispatchLng ? `Lat ${dispatchLat}, Lng ${dispatchLng}` : ""}
          </span>
        </div>
        <p className="text-xs text-slate-600">{t.routingSettingsHint}</p>
        <Button onClick={handleSave}>{t.saveSettings}</Button>
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
