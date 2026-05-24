import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import type { MainSettingsDoc } from "../../types/firestore";
import { updateOrderingStatus, updateSettingsPatch } from "./adminService";

interface SettingsPanelProps {
  settings: MainSettingsDoc;
}

export function SettingsPanel({ settings }: SettingsPanelProps): JSX.Element {
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [template, setTemplate] = useState(settings.deliveryMessage.template);
  const [startTime, setStartTime] = useState(settings.deliveryMessage.startTime ?? "19:00");
  const [endTime, setEndTime] = useState(settings.deliveryMessage.endTime ?? "22:00");
  const [customTh, setCustomTh] = useState(settings.deliveryMessage.customMessageTh ?? "");
  const [customEn, setCustomEn] = useState(settings.deliveryMessage.customMessageEn ?? "");

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
    });
  };

  return (
    <Card title="Ordering and delivery message">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button
            variant={settings.orderingOpen ? "primary" : "secondary"}
            onClick={() => updateOrderingStatus(true)}
          >
            Open ordering
          </Button>
          <Button
            variant={!settings.orderingOpen ? "danger" : "secondary"}
            onClick={() => updateOrderingStatus(false)}
          >
            Close ordering
          </Button>
        </div>
        <Input
          label="Announcement"
          value={announcement}
          onChange={(event) => setAnnouncement(event.target.value)}
        />
        <Select
          label="Delivery message template"
          value={template}
          onChange={(event) => setTemplate(event.target.value as MainSettingsDoc["deliveryMessage"]["template"])}
          options={[
            { value: "estimated_range", label: "Estimated delivery today: start-end" },
            { value: "starts_after", label: "Delivery starts after start" },
            { value: "varies", label: "Estimated delivery time varies" },
            { value: "custom", label: "Custom message" },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Start time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          <Input label="End time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </div>
        <Input label="Custom Thai message" value={customTh} onChange={(event) => setCustomTh(event.target.value)} />
        <Input label="Custom English message" value={customEn} onChange={(event) => setCustomEn(event.target.value)} />
        <Button onClick={handleSave}>Save settings</Button>
      </div>
    </Card>
  );
}
