"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FleetDevice } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { DEFAULT_CENTER, devicesWithPosition, kph, statusLabel, type MapFollow } from "@/lib/format";

function markerIcon(device: FleetDevice, selected: boolean, isSelf: boolean) {
  const color = isSelf ? "#ef4444" : VEHICLE_META[device.vehicleType].color;
  const ring = selected || isSelf ? "#fff" : "rgba(255,255,255,0.35)";
  const label = isSelf ? "YOU" : device.callSign;
  const html = `
    <div style="
      transform: translate(-50%, -100%);
      display:flex; flex-direction:column; align-items:center; font-family: Inter, system-ui, sans-serif;
    ">
      <div style="
        background:${color}; color:#0b1220; font-weight:800; font-size:11px; letter-spacing:.04em;
        padding:4px 7px; border-radius:999px; border:2px solid ${ring}; box-shadow:0 8px 20px rgba(0,0,0,.35);
        white-space:nowrap;
      ">${label}</div>
      <div style="
        width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent;
        border-top:9px solid ${color}; margin-top:-1px;
      "></div>
    </div>`;
  return L.divIcon({ className: "fleet-pin", html, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function Camera({
  devices,
  follow,
  stickToMe,
  recenterKey,
  onUserPan,
}: {
  devices: FleetDevice[];
  follow: MapFollow | null;
  stickToMe: boolean;
  recenterKey: number;
  onUserPan: () => void;
}) {
  const map = useMap();
  const idKey = devicesWithPosition(devices)
    .map((d) => `${d.id}:${d.simulated ? "s" : "r"}`)
    .sort()
    .join(",");

  useMapEvents({
    dragstart() {
      onUserPan();
    },
  });

  useEffect(() => {
    if (!follow) return;
    if (!stickToMe && recenterKey === 0) return;
    map.setView([follow.lat, follow.lng], Math.max(map.getZoom(), 16));
  }, [map, follow, stickToMe, recenterKey]);

  useEffect(() => {
    if (follow) return;
    const real = devicesWithPosition(devices).filter((d) => !d.simulated);
    const pool = real.length > 0 ? real : devicesWithPosition(devices);
    if (pool.length === 0) return;
    if (pool.length === 1) {
      map.setView([pool[0].lat as number, pool[0].lng as number], 15);
      return;
    }
    const bounds = L.latLngBounds(
      pool.map((d) => [d.lat as number, d.lng as number] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    // Fit only when the set of vehicles changes, not on every GPS tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, follow, idKey]);

  return null;
}

type Props = {
  devices: FleetDevice[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  follow: MapFollow | null;
  stickToMe: boolean;
  recenterKey: number;
  onUserPan: () => void;
  selfId: string | null;
};

export default function LeafletFleetMap({
  devices,
  now,
  selectedId,
  onSelect,
  follow,
  stickToMe,
  recenterKey,
  onUserPan,
  selfId,
}: Props) {
  const positioned = useMemo(() => devicesWithPosition(devices), [devices]);

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={3}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <Camera
        devices={devices}
        follow={follow}
        stickToMe={stickToMe}
        recenterKey={recenterKey}
        onUserPan={onUserPan}
      />
      {positioned.map((device) => (
        <Marker
          key={device.id}
          position={[device.lat as number, device.lng as number]}
          icon={markerIcon(device, device.id === selectedId, device.id === selfId)}
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
              {device.simulated ? <div>Training / fake GPS</div> : null}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
