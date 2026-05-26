import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

  useEffect(() => {
    if (isOpen) {
      setSelected(defaultCenter);
    }
  }, [defaultCenter, isOpen]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-black/40 p-3 sm:p-4">
      <div className="mx-auto mt-2 w-full max-w-2xl space-y-3 rounded-xl border border-brand-gold/30 bg-white p-3 shadow-lg sm:mt-6 sm:p-4">
        <div className="pr-6">
          <h3 className="text-base font-semibold text-brand-redDark sm:text-lg">{title}</h3>
          <p className="text-xs text-slate-600">Click on map to drop a pin.</p>
        </div>
        <div className="h-[55vh] min-h-64 max-h-[420px] overflow-hidden rounded-lg border border-brand-gold/30">
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
        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <Button size="compact" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="compact"
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
    </div>,
    document.body,
  );
}
