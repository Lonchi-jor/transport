"use client";

import dynamic from "next/dynamic";
import type { FleetDevice } from "@/lib/types";

const LeafletFleetMap = dynamic(() => import("@/components/leaflet-fleet-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const GoogleFleetMap = dynamic(() => import("@/components/google-fleet-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#d9e4d6] text-sm text-muted-foreground">
      Loading map…
    </div>
  );
}

type Props = {
  googleMapsApiKey: string;
  devices: FleetDevice[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function FleetMap({
  googleMapsApiKey,
  devices,
  now,
  selectedId,
  onSelect,
}: Props) {
  if (googleMapsApiKey) {
    return (
      <GoogleFleetMap
        apiKey={googleMapsApiKey}
        devices={devices}
        now={now}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    );
  }

  return (
    <LeafletFleetMap devices={devices} now={now} selectedId={selectedId} onSelect={onSelect} />
  );
}
