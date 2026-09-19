"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BusFront, Crosshair, LogOut, Radio, Route, Users } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FleetMap from "@/components/fleet-map";
import JoinScreen, { type JoinPayload } from "@/components/join-screen";
import type { FleetDevice, FleetSnapshot } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { DEFAULT_CENTER, formatAge, kph, statusLabel } from "@/lib/format";

const SESSION_KEY = "transitlive-session";

type Session = JoinPayload & { id: string };

type Props = {
  googleMapsApiKey: string;
};

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export default function FleetApp({ googleMapsApiKey }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [now, setNow] = useState(0);
  const [demo, setDemo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "live" | "denied" | "simulated">("idle");
  const [gpsHint, setGpsHint] = useState("");
  const [online, setOnline] = useState(true);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [hasFix, setHasFix] = useState(false);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; heading: number | null; speedMps: number | null; accuracy: number | null } | null>(null);
  const gpsModeRef = useRef<"idle" | "live" | "denied" | "simulated">("idle");
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    const saved = loadSession();
    if (!saved) return;
    const id = window.setTimeout(() => setSession(saved), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const applySnapshot = useCallback((snapshot: FleetSnapshot & { demo?: boolean }) => {
    setDevices(snapshot.devices);
    setNow(snapshot.now);
    if (typeof snapshot.demo === "boolean") setDemo(snapshot.demo);
    setOnline(true);
  }, []);

  const sendHeartbeat = useCallback(async (current: Session) => {
    const fix = lastFix.current;
    const body = {
      id: current.id,
      callSign: current.callSign,
      driverName: current.driverName,
      vehicleType: current.vehicleType,
      role: current.role,
      sharing: current.role === "driver" && Boolean(fix),
      simulated: gpsModeRef.current === "simulated",
      lat: current.role === "driver" ? fix?.lat ?? null : null,
      lng: current.role === "driver" ? fix?.lng ?? null : null,
      heading: fix?.heading ?? null,
      speedMps: fix?.speedMps ?? null,
      accuracy: fix?.accuracy ?? null,
    };
    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("heartbeat failed");
      const snapshot = (await res.json()) as FleetSnapshot;
      applySnapshot(snapshot);
    } catch {
      setOnline(false);
    }
  }, [applySnapshot]);

  const startSimulation = useCallback((current: Session) => {
    if (simTimer.current) clearInterval(simTimer.current);
    const origin = lastFix.current ?? { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
    let t = 0;
    gpsModeRef.current = "simulated";
    setGpsState("simulated");
    setGpsHint("GPS unavailable on this phone. Using a simulated city route so you still appear on the map.");
    simTimer.current = setInterval(() => {
      t += 1;
      const lat = origin.lat + Math.sin(t / 18) * 0.008;
      const lng = origin.lng + Math.cos(t / 14) * 0.01;
      lastFix.current = {
        lat,
        lng,
        heading: (t * 12) % 360,
        speedMps: 8.5,
        accuracy: 12,
      };
      setHasFix(true);
      void sendHeartbeat(current);
    }, 2000);
  }, [sendHeartbeat]);

  const startGps = useCallback(
    (current: Session) => {
      if (current.role !== "driver") {
        void sendHeartbeat(current);
        return;
      }
      if (!navigator.geolocation) {
        startSimulation(current);
        return;
      }
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          lastFix.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
            speedMps: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
            accuracy: pos.coords.accuracy ?? null,
          };
          setHasFix(true);
          gpsModeRef.current = "live";
          setGpsState("live");
          setGpsHint("");
          void sendHeartbeat(current);
        },
        (err) => {
          gpsModeRef.current = "denied";
          setGpsState("denied");
          setGpsHint(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was blocked. Running a simulated city route so this vehicle still appears."
              : "Could not read GPS. Running a simulated city route so this vehicle still appears.",
          );
          startSimulation(current);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 },
      );
    },
    [sendHeartbeat, startSimulation],
  );

  useEffect(() => {
    if (!session) return;

    const start = window.setTimeout(() => startGps(session), 0);
    const beat = setInterval(() => {
      void sendHeartbeat(session);
    }, 4000);

    const source = new EventSource("/api/fleet/stream");
    source.onmessage = (event) => {
      try {
        applySnapshot(JSON.parse(event.data) as FleetSnapshot & { demo?: boolean });
      } catch {
        /* ignore malformed frames */
      }
    };
    source.onerror = () => setOnline(false);

    const leave = () => {
      const payload = JSON.stringify({ id: session.id });
      navigator.sendBeacon("/api/fleet/leave", payload);
    };
    window.addEventListener("pagehide", leave);

    return () => {
      clearTimeout(start);
      clearInterval(beat);
      source.close();
      window.removeEventListener("pagehide", leave);
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (simTimer.current) clearInterval(simTimer.current);
    };
  }, [session, applySnapshot, sendHeartbeat, startGps]);

  function join(payload: JoinPayload) {
    const next: Session = { ...payload, id: crypto.randomUUID() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  }

  async function leave() {
    if (!session) return;
    await fetch(`/api/fleet?id=${encodeURIComponent(session.id)}`, { method: "DELETE" });
    sessionStorage.removeItem(SESSION_KEY);
    lastFix.current = null;
    setHasFix(false);
    setSession(null);
    setDevices([]);
    setGpsState("idle");
  }

  async function toggleDemo() {
    const res = await fetch("/api/fleet/demo", { method: demo ? "DELETE" : "POST" });
    const snapshot = (await res.json()) as FleetSnapshot & { demo?: boolean };
    applySnapshot(snapshot);
  }

  const liveVehicles = useMemo(
    () => devices.filter((d) => d.role === "driver"),
    [devices],
  );
  const selected = devices.find((d) => d.id === selectedId) ?? null;
  const mapProvider = googleMapsApiKey ? "Google Maps" : "OpenStreetMap";

  if (!session) {
    return <JoinScreen onJoin={join} />;
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-zinc-950/80 px-3 py-2 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-300 text-zinc-950">
              <Radio className="size-3.5" />
            </span>
            TransitLive
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-300">
            <span className={`size-1.5 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`} />
            {online ? "Live" : "Reconnecting"} · {liveVehicles.length} vehicles · {mapProvider}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void leave()}
          className="pointer-events-auto h-9 rounded-xl bg-zinc-950/80 text-zinc-100"
        >
          <LogOut />
          Leave
        </Button>
      </header>

      <div className="absolute inset-0">
        <FleetMap
          googleMapsApiKey={googleMapsApiKey}
          devices={devices}
          now={now}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {gpsHint ? (
        <div className="absolute top-[5.5rem] right-3 z-20 max-w-[16rem] rounded-xl border border-white/10 bg-zinc-950/85 p-3 text-xs leading-5 text-zinc-200 shadow-lg backdrop-blur">
          {gpsHint}
          {gpsState !== "simulated" ? (
            <Button
              size="sm"
              className="mt-2 h-8 w-full rounded-lg bg-amber-300 text-zinc-950"
              onClick={() => startSimulation(session)}
            >
              Use simulated GPS
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-3 bottom-28 z-20 flex flex-col gap-2">
        <Button
          variant="secondary"
          className="pointer-events-auto h-11 rounded-full bg-zinc-950/80 px-3 shadow-lg"
          onClick={() => void toggleDemo()}
        >
          <Route className="size-4" />
          {demo ? "Stop demo" : "Demo fleet"}
        </Button>
        {hasFix ? (
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto size-11 rounded-full bg-zinc-950/80 shadow-lg"
            onClick={() => setSelectedId(session.id)}
          >
            <Crosshair className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto rounded-3xl border border-white/10 bg-zinc-950/88 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {session.callSign} · {session.driverName}
              </div>
              <div className="text-xs text-zinc-400">
                {session.role === "driver" ? "Broadcasting this device" : "Dispatch console"}
                {gpsState === "live" ? " · GPS live" : gpsState === "simulated" ? " · simulated route" : ""}
              </div>
            </div>
            <Sheet open={fleetOpen} onOpenChange={setFleetOpen}>
              <Button
                size="sm"
                className="rounded-xl bg-amber-300 text-zinc-950 hover:bg-amber-200"
                onClick={() => setFleetOpen(true)}
              >
                <Users />
                Fleet
              </Button>
              <SheetContent side="bottom" className="h-[70dvh] rounded-t-3xl">
                <SheetHeader>
                  <SheetTitle>Connected devices</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto px-4 pb-6">
                  {devices.length === 0 ? (
                    <p className="py-8 text-sm text-muted-foreground">
                      No vehicles on the radio yet. Join from another phone or start the demo fleet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {devices.map((device) => (
                        <li key={device.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(device.id);
                              setFleetOpen(false);
                            }}
                            className="flex w-full items-start justify-between rounded-2xl border border-border bg-card px-3 py-3 text-left"
                          >
                            <div>
                              <div className="flex items-center gap-2 font-semibold">
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{ background: VEHICLE_META[device.vehicleType].color }}
                                />
                                {device.callSign}
                                {device.id === session.id ? (
                                  <Badge variant="secondary">You</Badge>
                                ) : null}
                                {device.simulated ? <Badge variant="outline">Demo</Badge> : null}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {device.driverName} · {VEHICLE_META[device.vehicleType].label}
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-medium">{statusLabel(device, now)}</div>
                              <div className="text-muted-foreground">
                                {kph(device.speedMps) != null ? `${kph(device.speedMps)} km/h · ` : ""}
                                {formatAge(device.lastSeen, now)}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {selected ? (
            <div className="rounded-2xl bg-white/5 px-3 py-2 text-xs text-zinc-200">
              <div className="flex items-center gap-2 font-medium">
                <BusFront className="size-3.5" />
                {selected.callSign} selected
              </div>
              <div className="mt-1 text-zinc-400">
                {selected.driverName} · {statusLabel(selected, now)}
                {selected.lat != null
                  ? ` · ${selected.lat.toFixed(4)}, ${selected.lng?.toFixed(4)}`
                  : " · no coordinates"}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              Tap a marker or open Fleet to inspect a vehicle. Start demo vehicles if you are testing without extra phones.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
