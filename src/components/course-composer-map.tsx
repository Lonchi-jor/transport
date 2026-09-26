"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { DEFAULT_CENTER } from "@/lib/format";

export type ComposerPin = {
  lat: number;
  lng: number;
  label: string;
};

function pinIcon(kind: "pickup" | "dropoff") {
  const color = kind === "pickup" ? "#00a4e8" : "#2b308f";
  const text = kind === "pickup" ? "Départ" : "Arrivée";
  const html = `
    <div style="
      transform: translate(-50%, -100%);
      display:flex; flex-direction:column; align-items:center; font-family: Inter, system-ui, sans-serif;
    ">
      <div style="
        background:${color}; color:#fff; font-weight:800; font-size:11px; letter-spacing:.04em;
        padding:4px 8px; border-radius:999px; border:2px solid #fff; box-shadow:0 8px 20px rgba(0,0,0,.35);
        white-space:nowrap;
      ">${text}</div>
      <div style="
        width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent;
        border-top:9px solid ${color}; margin-top:-1px;
      "></div>
    </div>`;
  return L.divIcon({ className: "composer-pin", html, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function MapChrome({
  flyTo,
  flyKey,
  skipClickRef,
  onClick,
}: {
  flyTo: { lat: number; lng: number } | null;
  flyKey: number;
  skipClickRef: MutableRefObject<boolean>;
  onClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(event) {
      if (skipClickRef.current) {
        skipClickRef.current = false;
        return;
      }
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [map, flyKey]);

  useEffect(() => {
    if (!flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], Math.max(map.getZoom(), 16), { duration: 0.85 });
  }, [map, flyTo, flyKey]);

  return null;
}

type Props = {
  pickup: ComposerPin | null;
  dropoff: ComposerPin | null;
  routePath: [number, number][] | null;
  flyTo: { lat: number; lng: number } | null;
  flyKey: number;
  onMapClick: (lat: number, lng: number) => void;
  onPickupMove: (lat: number, lng: number) => void;
  onDropoffMove: (lat: number, lng: number) => void;
};

export default function CourseComposerMap({
  pickup,
  dropoff,
  routePath,
  flyTo,
  flyKey,
  onMapClick,
  onPickupMove,
  onDropoffMove,
}: Props) {
  const skipClickRef = useRef(false);

  return (
    <MapContainer
      center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
      zoom={13}
      className="z-0 h-full w-full"
      zoomControl
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapChrome flyTo={flyTo} flyKey={flyKey} skipClickRef={skipClickRef} onClick={onMapClick} />
      {routePath && routePath.length >= 2 ? (
        <Polyline positions={routePath} pathOptions={{ color: "#2b308f", weight: 5, opacity: 0.9 }} />
      ) : pickup && dropoff ? (
        <Polyline
          positions={[
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ]}
          pathOptions={{ color: "#2b308f", weight: 4, opacity: 0.55, dashArray: "8 8" }}
        />
      ) : null}
      {pickup ? (
        <Marker
          position={[pickup.lat, pickup.lng]}
          draggable
          icon={pinIcon("pickup")}
          eventHandlers={{
            dragstart: () => {
              skipClickRef.current = true;
            },
            dragend: (event) => {
              skipClickRef.current = true;
              const ll = event.target.getLatLng();
              onPickupMove(ll.lat, ll.lng);
            },
          }}
        >
          <Popup>
            Départ
            <div className="text-xs">{pickup.label}</div>
            <div className="mt-1 text-[11px] text-[#5b6294]">Glissez le point pour le déplacer.</div>
          </Popup>
        </Marker>
      ) : null}
      {dropoff ? (
        <Marker
          position={[dropoff.lat, dropoff.lng]}
          draggable
          icon={pinIcon("dropoff")}
          eventHandlers={{
            dragstart: () => {
              skipClickRef.current = true;
            },
            dragend: (event) => {
              skipClickRef.current = true;
              const ll = event.target.getLatLng();
              onDropoffMove(ll.lat, ll.lng);
            },
          }}
        >
          <Popup>
            Arrivée
            <div className="text-xs">{dropoff.label}</div>
            <div className="mt-1 text-[11px] text-[#5b6294]">Glissez le point pour le déplacer.</div>
          </Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
