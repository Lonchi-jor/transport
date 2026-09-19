"use client";

import dynamic from "next/dynamic";
import type { FleetDevice } from "@/lib/types";
import type { MapFollow } from "@/lib/format";

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

export type { MapFollow };

type Props = {
  googleMapsApiKey: string;
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

export default function FleetMap({
  googleMapsApiKey,
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
  if (googleMapsApiKey) {
    return (
      <GoogleFleetMap
        apiKey={googleMapsApiKey}
        devices={devices}
        now={now}
        selectedId={selectedId}
        onSelect={onSelect}
        follow={follow}
        stickToMe={stickToMe}
        recenterKey={recenterKey}
        onUserPan={onUserPan}
        selfId={selfId}
      />
    );
  }

  return (
    <LeafletFleetMap
      devices={devices}
      now={now}
      selectedId={selectedId}
      onSelect={onSelect}
      follow={follow}
      stickToMe={stickToMe}
      recenterKey={recenterKey}
      onUserPan={onUserPan}
      selfId={selfId}
    />
  );
}
