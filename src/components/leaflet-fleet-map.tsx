"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { FleetDevice } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { DEFAULT_CENTER, devicesWithPosition, kph, statusLabel } from "@/lib/format";

function markerIcon(device: FleetDevice, selected: boolean) {
  const color = VEHICLE_META[device.vehicleType].color;
  const ring = selected ? "#fff" : "rgba(255,255,255,0.35)";
  const html = `
    <div style="
      transform: translate(-50%, -100%);
      display:flex; flex-direction:column; align-items:center; font-family: Inter, system-ui, sans-serif;
    ">
      <div style="
        background:${color}; color:#0b1220; font-weight:800; font-size:11px; letter-spacing:.04em;
        padding:4px 7px; border-radius:999px; border:2px solid ${ring}; box-shadow:0 8px 20px rgba(0,0,0,.35);
        white-space:nowrap;
      ">${device.callSign}</div>
      <div style="
        width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent;
        border-top:9px solid ${color}; margin-top:-1px;
      "></div>
    </div>`;
  return L.divIcon({ className: "fleet-pin", html, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function FitBounds({ devices }: { devices: FleetDevice[] }) {
  const map = useMap();
  const lastKey = useRef("");
  const positioned = devicesWithPosition(devices);
  const key = positioned.map((d) => d.id).sort().join(",");

  useEffect(() => {
    if (key === lastKey.current && lastKey.current !== "") return;
    lastKey.current = key;
    if (positioned.length === 0) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
      return;
    }
    if (positioned.length === 1) {
      map.setView([positioned[0].lat as number, positioned[0].lng as number], 15);
      return;
    }
    const bounds = L.latLngBounds(
      positioned.map((d) => [d.lat as number, d.lng as number] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, key, positioned]);

  return null;
}

type Props = {
  devices: FleetDevice[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function LeafletFleetMap({ devices, now, selectedId, onSelect }: Props) {
  const positioned = useMemo(() => devicesWithPosition(devices), [devices]);

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={13}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds devices={devices} />
      {positioned.map((device) => (
        <Marker
          key={device.id}
          position={[device.lat as number, device.lng as number]}
          icon={markerIcon(device, device.id === selectedId)}
          eventHandlers={{ click: () => onSelect(device.id) }}
        >
          <Popup>
            <div className="min-w-40 text-sm">
              <div className="font-semibold">{device.callSign}</div>
              <div>{device.driverName}</div>
              <div>
                {statusLabel(device, now)}
                {kph(device.speedMps) != null ? ` · ${kph(device.speedMps)} km/h` : ""}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
