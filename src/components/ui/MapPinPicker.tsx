import { useMemo, useState } from "react";
import { MapContainer, TileLayer, useMapEvents, CircleMarker } from "react-leaflet";
import { Button } from "./Button";

interface MapPinPickerProps {
  isOpen: boolean;
  title: string;
  initialLat?: number;
  initialLng?: number;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
}

interface ClickHandlerProps {
  selected: [number, number] | null;
  onSelect: (coords: [number, number]) => void;
}

function ClickHandler({ selected, onSelect }: ClickHandlerProps): JSX.Element | null {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    },
  });

  if (!selected) {
    return null;
  }

  return <CircleMarker center={selected} radius={8} pathOptions={{ color: "#b91c1c" }} />;
}

export function MapPinPicker({
  isOpen,
  title,
  initialLat,
  initialLng,
  onClose,
  onConfirm,
}: MapPinPickerProps): JSX.Element | null {
  const defaultCenter = useMemo<[number, number]>(() => {
    if (initialLat !== undefined && initialLng !== undefined) {
      return [initialLat, initialLng];
    }
    return [12.9236, 100.8825];
  }, [initialLat, initialLng]);
  const [selected, setSelected] = useState<[number, number] | null>(defaultCenter);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl space-y-3 rounded-xl border border-brand-gold/30 bg-white p-4 shadow-lg">
        <div>
          <h3 className="text-lg font-semibold text-brand-redDark">{title}</h3>
          <p className="text-xs text-slate-600">Click on map to drop a pin.</p>
        </div>
        <div className="h-80 overflow-hidden rounded-lg border border-brand-gold/30">
          <MapContainer center={defaultCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler selected={selected} onSelect={setSelected} />
          </MapContainer>
        </div>
        <div className="text-sm text-slate-700">
          {selected ? `Lat: ${selected[0].toFixed(6)}, Lng: ${selected[1].toFixed(6)}` : "No pin selected"}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selected) {
                onConfirm(selected[0], selected[1]);
              }
            }}
            disabled={!selected}
          >
            Use this pin
          </Button>
        </div>
      </div>
    </div>
  );
}
