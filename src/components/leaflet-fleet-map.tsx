"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FleetDevice } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { DEFAULT_CENTER, devicesWithPosition, kph, statusLabel, type MapFollow, type MapRoute } from "@/lib/format";

function markerIcon(device: FleetDevice, selected: boolean, isSelf: boolean) {
  const color = isSelf ? "#00a4e8" : VEHICLE_META[device.vehicleType].color;
  const ring = selected || isSelf ? "#fff" : "rgba(255,255,255,0.35)";
  const label = isSelf ? "YOU" : device.callSign;
  const text = isSelf ? "#ffffff" : "#0b1220";
  const html = `
    <div style="
      transform: translate(-50%, -100%);
      display:flex; flex-direction:column; align-items:center; font-family: Inter, system-ui, sans-serif;
    ">
      <div style="
        background:${color}; color:${text}; font-weight:800; font-size:11px; letter-spacing:.04em;
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
  route,
}: {
  devices: FleetDevice[];
  follow: MapFollow | null;
  stickToMe: boolean;
  recenterKey: number;
  onUserPan: () => void;
  route: MapRoute | null;
}) {
  const map = useMap();
  const idKey = devicesWithPosition(devices)
    .map((d) => `${d.id}:${d.simulated ? "s" : "r"}`)
    .sort()
    .join(",");
  const routeKey = route?.path.map((p) => p.join(",")).join(";") ?? "";

  useMapEvents({
    dragstart() {
      onUserPan();
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(t);
  }, [map]);

  useEffect(() => {
    if (!route || route.path.length < 2 || follow) return;
    map.fitBounds(L.latLngBounds(route.path), { padding: [36, 36], maxZoom: 16 });
  }, [map, route, follow, routeKey]);

  useEffect(() => {
    if (!follow) return;
    if (!stickToMe && recenterKey === 0) return;
    map.setView([follow.lat, follow.lng], Math.max(map.getZoom(), 16));
  }, [map, follow, stickToMe, recenterKey]);

  useEffect(() => {
    if (follow || route) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, follow, route, idKey]);

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
  route: MapRoute | null;
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
  route,
}: Props) {
  const positioned = useMemo(() => devicesWithPosition(devices), [devices]);

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={3}
      className="z-0 h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Camera
        devices={devices}
        follow={follow}
        stickToMe={stickToMe}
        recenterKey={recenterKey}
        onUserPan={onUserPan}
        route={route}
      />
      {route ? (
        <>
          <Polyline
            positions={route.path}
            pathOptions={{ color: "#2b308f", weight: 6, opacity: 0.9 }}
          />
          <CircleMarker
            center={[route.pickup.lat, route.pickup.lng]}
            radius={9}
            pathOptions={{ color: "#2b308f", fillColor: "#00a4e8", fillOpacity: 1 }}
          >
            <Popup>Départ · {route.pickup.label}</Popup>
          </CircleMarker>
          <CircleMarker
            center={[route.dropoff.lat, route.dropoff.lng]}
            radius={9}
            pathOptions={{ color: "#2b308f", fillColor: "#2b308f", fillOpacity: 1 }}
          >
            <Popup>Arrivée · {route.dropoff.label}</Popup>
          </CircleMarker>
        </>
      ) : null}
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
