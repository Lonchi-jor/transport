"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { DEFAULT_CENTER } from "@/lib/format";
import { numberedMapIcon } from "@/lib/leaflet-pins";

export type ComposerPin = {
  id?: string;
  lat: number;
  lng: number;
  label: string;
};

function pinIcon(kind: "voyage" | "stop", index?: number) {
  return numberedMapIcon(kind, index, true);
}

function MapChrome({
  flyTo,
  flyKey,
  skipUntilRef,
  draggingRef,
  onClick,
}: {
  flyTo: { lat: number; lng: number } | null;
  flyKey: number;
  skipUntilRef: MutableRefObject<number>;
  draggingRef: MutableRefObject<boolean>;
  onClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(event) {
      if (draggingRef.current || Date.now() < skipUntilRef.current) return;
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(t);
  }, [map, flyKey]);

  useEffect(() => {
    if (!flyTo || draggingRef.current) return;
    map.flyTo([flyTo.lat, flyTo.lng], Math.max(map.getZoom(), 16), { duration: 0.85 });
  }, [map, flyTo, flyKey, draggingRef]);

  return null;
}

function DraggablePin({
  lat,
  lng,
  icon,
  title,
  skipUntilRef,
  draggingRef,
  onMoved,
}: {
  lat: number;
  lng: number;
  icon: L.DivIcon;
  title: string;
  skipUntilRef: MutableRefObject<number>;
  draggingRef: MutableRefObject<boolean>;
  onMoved: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const dragging = useRef(false);
  const onMovedRef = useRef(onMoved);
  onMovedRef.current = onMoved;
  const position = useMemo(() => L.latLng(lat, lng), [lat, lng]);
  const eventHandlers = useMemo(
    () => ({
      dragstart: () => {
        dragging.current = true;
        draggingRef.current = true;
        skipUntilRef.current = Date.now() + 1200;
        map.dragging.disable();
      },
      dragend: (event: L.LeafletEvent) => {
        const ll = (event.target as L.Marker).getLatLng();
        dragging.current = false;
        draggingRef.current = false;
        skipUntilRef.current = Date.now() + 600;
        if (!map.dragging.enabled()) map.dragging.enable();
        onMovedRef.current(ll.lat, ll.lng);
      },
    }),
    [map, draggingRef, skipUntilRef],
  );

  useEffect(() => {
    if (dragging.current) return;
    markerRef.current?.setLatLng(position);
  }, [position]);

  useEffect(() => {
    return () => {
      draggingRef.current = false;
      if (!map.dragging.enabled()) map.dragging.enable();
    };
  }, [map, draggingRef]);

  return (
    <Marker
      ref={(marker) => {
        markerRef.current = marker;
      }}
      position={position}
      icon={icon}
      title={title}
      draggable
      autoPan
      zIndexOffset={900}
      autoPanPadding={[48, 48]}
      bubblingMouseEvents={false}
      eventHandlers={eventHandlers}
    />
  );
}

type Props = {
  pickup: ComposerPin | null;
  stops: ComposerPin[];
  routePath: [number, number][] | null;
  flyTo: { lat: number; lng: number } | null;
  flyKey: number;
  onMapClick: (lat: number, lng: number) => void;
  onPickupMove: (lat: number, lng: number) => void;
  onStopMove: (id: string, lat: number, lng: number) => void;
};

export default function CourseComposerMap({
  pickup,
  stops,
  routePath,
  flyTo,
  flyKey,
  onMapClick,
  onPickupMove,
  onStopMove,
}: Props) {
  const skipUntilRef = useRef(0);
  const draggingRef = useRef(false);
  const voyageIcon = useMemo(() => pinIcon("voyage"), []);
  const stopIcons = useMemo(() => stops.map((_, index) => pinIcon("stop", index)), [stops.length]);
  const path =
    routePath && routePath.length >= 2
      ? routePath
      : pickup && stops.length
        ? [[pickup.lat, pickup.lng] as [number, number], ...stops.map((stop) => [stop.lat, stop.lng] as [number, number])]
        : null;

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
      <MapChrome
        flyTo={flyTo}
        flyKey={flyKey}
        skipUntilRef={skipUntilRef}
        draggingRef={draggingRef}
        onClick={onMapClick}
      />
      {path && path.length >= 2 ? (
        <Polyline
          positions={path}
          pathOptions={{
            color: "#2b308f",
            weight: routePath && routePath.length >= 2 ? 5 : 4,
            opacity: routePath && routePath.length >= 2 ? 0.9 : 0.55,
            dashArray: routePath && routePath.length >= 2 ? undefined : "8 8",
          }}
        />
      ) : null}
      {pickup ? (
        <DraggablePin
          lat={pickup.lat}
          lng={pickup.lng}
          icon={voyageIcon}
          title="Glissez pour déplacer le point de départ"
          skipUntilRef={skipUntilRef}
          draggingRef={draggingRef}
          onMoved={onPickupMove}
        />
      ) : null}
      {stops.map((stop, index) =>
        stop.id ? (
          <DraggablePin
            key={stop.id}
            lat={stop.lat}
            lng={stop.lng}
            icon={stopIcons[index] ?? pinIcon("stop", index)}
            title={`Glissez pour déplacer la destination ${index + 1}`}
            skipUntilRef={skipUntilRef}
            draggingRef={draggingRef}
            onMoved={(lat, lng) => onStopMove(stop.id as string, lat, lng)}
          />
        ) : null,
      )}
    </MapContainer>
  );
}
