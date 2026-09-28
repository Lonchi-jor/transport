"use client";

import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { FleetDevice } from "@/lib/types";
import { DEFAULT_CENTER, devicesWithPosition, formatWhen, kph, type MapFollow, type MapRoute } from "@/lib/format";
import { PRESENCE_COLOR, presenceHoverText, presenceKind, presenceLabel } from "@/lib/presence";

function markerIcon(device: FleetDevice, selected: boolean, isSelf: boolean, now: number) {
  const kind = presenceKind({ connected: device.connected, lastSeen: device.lastSeen }, now);
  const color = isSelf ? "#00a4e8" : PRESENCE_COLOR[kind === "unknown" ? "stale" : kind];
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
  frameSelfAndRoute,
}: {
  devices: FleetDevice[];
  follow: MapFollow | null;
  stickToMe: boolean;
  recenterKey: number;
  onUserPan: () => void;
  route: MapRoute | null;
  frameSelfAndRoute: boolean;
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
    const t1 = window.setTimeout(() => map.invalidateSize(), 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 280);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    if (!route || route.path.length < 2) return;
    if (follow && !frameSelfAndRoute) return;
    if (!stickToMe) return;
    const bounds = L.latLngBounds(route.path);
    if (follow) bounds.extend([follow.lat, follow.lng]);
    map.fitBounds(bounds, { padding: [48, 80], maxZoom: 16 });
  }, [map, route, follow, frameSelfAndRoute, stickToMe, recenterKey, routeKey]);

  useEffect(() => {
    if (!follow) return;
    if (frameSelfAndRoute && route && route.path.length >= 2) return;
    if (!stickToMe && recenterKey === 0) return;
    map.setView([follow.lat, follow.lng], Math.max(map.getZoom(), 16));
  }, [map, follow, stickToMe, recenterKey, frameSelfAndRoute, route, routeKey]);

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
  frameSelfAndRoute?: boolean;
  onAssignCourse?: (driverId: string) => void;
  assignBlockedMessage?: (driverId: string) => string | null;
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
  frameSelfAndRoute = false,
  onAssignCourse,
  assignBlockedMessage,
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
        frameSelfAndRoute={frameSelfAndRoute}
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
            <Popup>Voyage · {route.pickup.label}</Popup>
          </CircleMarker>
          {(route.stops?.length ? route.stops : [route.dropoff]).map((stop, index) => (
            <CircleMarker
              key={`tour-${index}-${stop.lat}-${stop.lng}`}
              center={[stop.lat, stop.lng]}
              radius={8}
              pathOptions={{
                color: "#2b308f",
                fillColor: index === (route.stops?.length ?? 1) - 1 ? "#2b308f" : "#4d7fe8",
                fillOpacity: 1,
              }}
            >
              <Popup>
                Destination {index + 1} · {stop.label}
              </Popup>
            </CircleMarker>
          ))}
        </>
      ) : null}
      {positioned.map((device) => {
        const blocked = onAssignCourse ? (assignBlockedMessage?.(device.id) ?? null) : null;
        return (
        <Marker
          key={device.id}
          position={[device.lat as number, device.lng as number]}
          icon={markerIcon(device, device.id === selectedId, device.id === selfId, now)}
          draggable={false}
          eventHandlers={{ click: () => onSelect(device.id) }}
        >
          <Tooltip direction="top" offset={[0, -28]} opacity={1} className="fleet-hover">
            <div className="min-w-36 text-xs leading-5">
              <div className="font-semibold">
                {device.callSign} · {device.driverName}
              </div>
              <div>{presenceHoverText(presenceKind({ connected: device.connected, lastSeen: device.lastSeen }, now), device.lastSeen, now)}</div>
            </div>
          </Tooltip>
          <Popup>
            <div className="min-w-40 text-sm">
              <div className="font-semibold">{device.callSign}</div>
              <div>{device.driverName}</div>
              {device.phone ? (
                <div>
                  <a href={`tel:${device.phone.replace(/[^\d+]/g, "")}`}>{device.phone}</a>
                </div>
              ) : null}
              <div>
                {presenceLabel(
                  presenceKind({ connected: device.connected, lastSeen: device.lastSeen }, now),
                  device.lastSeen,
                  now,
                )}
                {kph(device.speedMps) != null ? ` · ${kph(device.speedMps)} km/h` : ""}
              </div>
              {formatWhen(device.lastSeen) ? (
                <div>Horodatage : {formatWhen(device.lastSeen)}</div>
              ) : null}
              {onAssignCourse ? (
                <>
                  {blocked ? <div className="mt-2 text-xs text-red-600">{blocked}</div> : null}
                  <button
                    type="button"
                    disabled={Boolean(blocked)}
                    className="mt-2 w-full rounded-lg bg-[#2b308f] px-2 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (blocked) return;
                      onAssignCourse(device.id);
                    }}
                  >
                    Attribuer une course
                  </button>
                </>
              ) : null}
            </div>
          </Popup>
        </Marker>
        );
      })}
    </MapContainer>
  );
}
