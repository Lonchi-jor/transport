"use client";

import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";
import type { FleetDevice } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { DEFAULT_CENTER, devicesWithPosition, type MapFollow, type MapRoute } from "@/lib/format";

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

function RouteLayer({
  route,
  follow,
  frameSelfAndRoute,
  stickToMe,
}: {
  route: MapRoute | null;
  follow: MapFollow | null;
  frameSelfAndRoute: boolean;
  stickToMe: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !route || route.path.length < 2) return;
    const line = new google.maps.Polyline({
      path: route.path.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: "#2b308f",
      strokeWeight: 6,
      strokeOpacity: 0.9,
      map,
    });
    const start = new google.maps.Marker({
      position: { lat: route.pickup.lat, lng: route.pickup.lng },
      map,
      label: "A",
      title: route.pickup.label,
    });
    const end = new google.maps.Marker({
      position: { lat: route.dropoff.lat, lng: route.dropoff.lng },
      map,
      label: "B",
      title: route.dropoff.label,
    });
    const frame = (!follow || frameSelfAndRoute) && stickToMe;
    if (frame) {
      const bounds = new google.maps.LatLngBounds();
      for (const [lat, lng] of route.path) bounds.extend({ lat, lng });
      if (follow) bounds.extend({ lat: follow.lat, lng: follow.lng });
      map.fitBounds(bounds, 48);
    }
    return () => {
      line.setMap(null);
      start.setMap(null);
      end.setMap(null);
    };
  }, [map, route, follow, frameSelfAndRoute, stickToMe]);
  return null;
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

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("dragstart", () => onUserPan());
    return () => listener.remove();
  }, [map, onUserPan]);

  useEffect(() => {
    if (!map || !follow) return;
    if (frameSelfAndRoute && route && route.path.length >= 2) return;
    if (!stickToMe && recenterKey === 0) return;
    map.setCenter({ lat: follow.lat, lng: follow.lng });
    map.setZoom(Math.max(map.getZoom() ?? 16, 16));
  }, [map, follow, stickToMe, recenterKey, frameSelfAndRoute, route]);

  useEffect(() => {
    if (!map || follow || route) return;
    const real = devicesWithPosition(devices).filter((d) => !d.simulated);
    const pool = real.length > 0 ? real : devicesWithPosition(devices);
    if (pool.length === 0) return;
    if (pool.length === 1) {
      map.setCenter({ lat: pool[0].lat as number, lng: pool[0].lng as number });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const d of pool) {
      bounds.extend({ lat: d.lat as number, lng: d.lng as number });
    }
    map.fitBounds(bounds, 64);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, follow, route, idKey]);

  return null;
}

type InnerProps = {
  devices: FleetDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  follow: MapFollow | null;
  stickToMe: boolean;
  recenterKey: number;
  onUserPan: () => void;
  selfId: string | null;
  route: MapRoute | null;
  frameSelfAndRoute?: boolean;
};

function GoogleMapInner({
  devices,
  selectedId,
  onSelect,
  follow,
  stickToMe,
  recenterKey,
  onUserPan,
  selfId,
  route,
  frameSelfAndRoute = false,
}: InnerProps) {
  const positioned = useMemo(() => devicesWithPosition(devices), [devices]);

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={3}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      styles={MAP_STYLES}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      className="z-0 h-full w-full"
    >
      <Camera
        devices={devices}
        follow={follow}
        stickToMe={stickToMe}
        recenterKey={recenterKey}
        onUserPan={onUserPan}
        route={route}
        frameSelfAndRoute={frameSelfAndRoute}
      />
      <RouteLayer
        route={route}
        follow={follow}
        frameSelfAndRoute={frameSelfAndRoute}
        stickToMe={stickToMe}
      />
      {positioned.map((device) => {
        const isSelf = device.id === selfId;
        return (
          <Marker
            key={device.id}
            position={{ lat: device.lat as number, lng: device.lng as number }}
            title={isSelf ? `You · ${device.callSign}` : `${device.callSign} · ${device.driverName}`}
            label={{
              text: isSelf ? "YOU" : device.callSign,
              color: isSelf ? "#ffffff" : "#0b1220",
              fontSize: "11px",
              fontWeight: "800",
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: isSelf || device.id === selectedId ? 14 : 11,
              fillColor: isSelf ? "#00a4e8" : VEHICLE_META[device.vehicleType].color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }}
            onClick={() => onSelect(device.id)}
          />
        );
      })}
    </Map>
  );
}

export default function GoogleFleetMap({
  apiKey,
  devices,
  selectedId,
  onSelect,
  follow,
  stickToMe,
  recenterKey,
  onUserPan,
  selfId,
  route,
  frameSelfAndRoute = false,
}: InnerProps & { apiKey: string; now: number }) {
  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMapInner
        devices={devices}
        selectedId={selectedId}
        onSelect={onSelect}
        follow={follow}
        stickToMe={stickToMe}
        recenterKey={recenterKey}
        onUserPan={onUserPan}
        selfId={selfId}
        route={route}
        frameSelfAndRoute={frameSelfAndRoute}
      />
    </APIProvider>
  );
}
