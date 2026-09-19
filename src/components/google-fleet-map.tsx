"use client";

import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useRef } from "react";
import type { FleetDevice } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { DEFAULT_CENTER, devicesWithPosition } from "@/lib/format";

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

function FitToFleet({ devices }: { devices: FleetDevice[] }) {
  const map = useMap();
  const lastKey = useRef("");
  const positioned = devicesWithPosition(devices);
  const key = positioned.map((d) => d.id).sort().join(",");

  useEffect(() => {
    if (!map) return;
    if (key === lastKey.current && lastKey.current !== "") return;
    lastKey.current = key;

    if (positioned.length === 0) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(13);
      return;
    }
    if (positioned.length === 1) {
      map.setCenter({ lat: positioned[0].lat as number, lng: positioned[0].lng as number });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const d of positioned) {
      bounds.extend({ lat: d.lat as number, lng: d.lng as number });
    }
    map.fitBounds(bounds, 64);
  }, [map, key, positioned]);

  return null;
}

type InnerProps = {
  devices: FleetDevice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function GoogleMapInner({ devices, selectedId, onSelect }: InnerProps) {
  const positioned = useMemo(() => devicesWithPosition(devices), [devices]);

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      styles={MAP_STYLES}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      className="h-full w-full"
    >
      <FitToFleet devices={devices} />
      {positioned.map((device) => (
        <Marker
          key={device.id}
          position={{ lat: device.lat as number, lng: device.lng as number }}
          title={`${device.callSign} · ${device.driverName}`}
          label={{
            text: device.callSign,
            color: "#0b1220",
            fontSize: "11px",
            fontWeight: "800",
          }}
          icon={{
            path: "CIRCLE" as unknown as google.maps.SymbolPath,
            scale: device.id === selectedId ? 14 : 11,
            fillColor: VEHICLE_META[device.vehicleType].color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }}
          onClick={() => onSelect(device.id)}
        />
      ))}
    </Map>
  );
}

export default function GoogleFleetMap({
  apiKey,
  devices,
  selectedId,
  onSelect,
}: InnerProps & { apiKey: string; now: number }) {
  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMapInner devices={devices} selectedId={selectedId} onSelect={onSelect} />
    </APIProvider>
  );
}
