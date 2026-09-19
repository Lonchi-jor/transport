"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BusFront, ClipboardList, Crosshair, LogOut, Route, Smartphone, Users } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FleetMap from "@/components/fleet-map";
import JoinScreen, { type JoinPayload } from "@/components/join-screen";
import PhoneAccess from "@/components/phone-access";
import type { Course, FleetDevice, FleetSnapshot } from "@/lib/types";
import { VEHICLE_META } from "@/lib/types";
import { COURSE_STATUS_LABEL, DEFAULT_CENTER, formatAge, kph, statusLabel } from "@/lib/format";

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
  const [courses, setCourses] = useState<Course[]>([]);
  const [now, setNow] = useState(0);
  const [demo, setDemo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "live" | "denied" | "waiting" | "simulated">("idle");
  const [gpsHint, setGpsHint] = useState("");
  const [online, setOnline] = useState(true);
  const [fleetOpen, setFleetOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [hasFix, setHasFix] = useState(false);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [stickToMe, setStickToMe] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; heading: number | null; speedMps: number | null; accuracy: number | null } | null>(null);
  const gpsModeRef = useRef<"idle" | "live" | "denied" | "waiting" | "simulated">("idle");
  const gpsBoundId = useRef<string | null>(null);
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
    setCourses(snapshot.courses ?? []);
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

  const stopSimulation = useCallback(() => {
    if (simTimer.current) {
      clearInterval(simTimer.current);
      simTimer.current = null;
    }
  }, []);

  const applyRealFix = useCallback(
    (pos: GeolocationPosition, current: Session) => {
      stopSimulation();
      lastFix.current = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        speedMps: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null,
        accuracy: pos.coords.accuracy ?? null,
      };
      gpsModeRef.current = "live";
      setGpsState("live");
      setGpsHint("");
      setHasFix(true);
      setStickToMe(true);
      setMyPos({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      });
      void sendHeartbeat(current);
    },
    [sendHeartbeat, stopSimulation],
  );

  const startSimulation = useCallback((current: Session) => {
    if (simTimer.current) clearInterval(simTimer.current);
    const origin = { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
    let t = 0;
    gpsModeRef.current = "simulated";
    setGpsState("simulated");
    setGpsHint(
      "This pin is a training route near Nairobi, not your phone. Tap Use my real GPS and allow location.",
    );
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
      setMyPos({ lat, lng, accuracy: 12 });
      void sendHeartbeat(current);
    }, 2000);
  }, [sendHeartbeat]);

  const requestGps = useCallback(
    (current: Session) => {
      if (current.role !== "driver") {
        void sendHeartbeat(current);
        return;
      }
      if (!window.isSecureContext) {
        gpsModeRef.current = "denied";
        setGpsState("denied");
        setGpsHint("This page is not HTTPS, so the phone will not share your real GPS. Open the phone tunnel link.");
        return;
      }
      if (!navigator.geolocation) {
        gpsModeRef.current = "denied";
        setGpsState("denied");
        setGpsHint("This browser has no GPS. Open the link in Safari or Chrome on the phone.");
        return;
      }

      gpsModeRef.current = "waiting";
      setGpsState("waiting");
      setGpsHint("Waiting for this phone’s GPS. Allow location if the browser asks.");

      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      const opts: PositionOptions = {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 25000,
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => applyRealFix(pos, current),
        (err) => {
          if (gpsModeRef.current === "live") return;
          gpsModeRef.current = "denied";
          setGpsState("denied");
          const blocked = err.code === err.PERMISSION_DENIED;
          setGpsHint(
            blocked
              ? "Location is blocked. In the phone browser: site settings → Location → Allow, then tap Use my real GPS."
              : "No GPS fix yet. Turn on Location, go outside or near a window, then tap Use my real GPS.",
          );
        },
        opts,
      );

      watchId.current = navigator.geolocation.watchPosition(
        (pos) => applyRealFix(pos, current),
        (err) => {
          if (gpsModeRef.current === "live") return;
          gpsModeRef.current = "denied";
          setGpsState("denied");
          setGpsHint(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked. Allow it for this site, then tap Use my real GPS."
              : "Still waiting for a GPS fix. Keep the app open and tap Use my real GPS.",
          );
        },
        opts,
      );
      gpsBoundId.current = current.id;
    },
    [applyRealFix, sendHeartbeat],
  );

  useEffect(() => {
    if (!session) return;

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

    const leavePage = () => {
      const payload = JSON.stringify({ id: session.id });
      navigator.sendBeacon("/api/fleet/leave", payload);
    };
    window.addEventListener("pagehide", leavePage);

    return () => {
      clearInterval(beat);
      source.close();
      window.removeEventListener("pagehide", leavePage);
    };
  }, [session, applySnapshot, sendHeartbeat]);

  useEffect(() => {
    if (!session) {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      stopSimulation();
      return;
    }
    const timer = window.setTimeout(() => {
      if (gpsModeRef.current === "idle") {
        requestGps(session);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session, requestGps, stopSimulation]);

  function join(payload: JoinPayload) {
    const next: Session = { ...payload, id: crypto.randomUUID() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    requestGps(next);
    setSession(next);
  }

  async function leave() {
    if (!session) return;
    await fetch(`/api/fleet?id=${encodeURIComponent(session.id)}`, { method: "DELETE" });
    sessionStorage.removeItem(SESSION_KEY);
    lastFix.current = null;
    setHasFix(false);
    setMyPos(null);
    setGpsHint("");
    gpsModeRef.current = "idle";
    setSession(null);
    setDevices([]);
    setCourses([]);
    setGpsState("idle");
  }

  async function toggleDemo() {
    const res = await fetch("/api/fleet/demo", { method: demo ? "DELETE" : "POST" });
    const snapshot = (await res.json()) as FleetSnapshot & { demo?: boolean };
    applySnapshot(snapshot);
  }

  async function patchCourse(id: string, status: string) {
    const res = await fetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    applySnapshot((await res.json()) as FleetSnapshot);
  }

  const liveVehicles = useMemo(
    () => devices.filter((d) => d.role === "driver"),
    [devices],
  );
  const myJobs = useMemo(
    () =>
      courses.filter(
        (course) =>
          course.assignedDeviceId === session?.id &&
          (course.status === "assigned" || course.status === "en_route"),
      ),
    [courses, session?.id],
  );
  const currentJob = myJobs.find((c) => c.status === "en_route") ?? myJobs[0] ?? null;
  const follow = useMemo(() => {
    if (gpsState !== "live" || !myPos) return null;
    return { lat: myPos.lat, lng: myPos.lng };
  }, [gpsState, myPos]);
  const onUserPan = useCallback(() => setStickToMe(false), []);
  const selected = devices.find((d) => d.id === selectedId) ?? null;
  const mapProvider = googleMapsApiKey ? "Google Maps" : "OpenStreetMap";

  if (!session) {
    return <JoinScreen onJoin={join} />;
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#10143a] text-white">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto rounded-2xl border border-white/20 bg-[#151a45] px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BrandLogo variant="mark" className="size-8 rounded-md bg-white p-0.5 object-contain" />
            CCMM Flotte
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-blue-100">
            <span className={`size-1.5 rounded-full ${online ? "bg-[#00a4e8]" : "bg-red-400"}`} />
            {online ? "Live" : "Reconnecting"} · {liveVehicles.length} vehicles · {mapProvider}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void leave()}
          className="pointer-events-auto h-9 rounded-xl"
        >
          <LogOut />
          Leave
        </Button>
      </header>

      <div className="absolute inset-0 z-0 isolate">
        <FleetMap
          googleMapsApiKey={googleMapsApiKey}
          devices={devices}
          now={now}
          selectedId={selectedId}
          onSelect={setSelectedId}
          follow={follow}
          stickToMe={stickToMe}
          recenterKey={recenterKey}
          onUserPan={onUserPan}
          selfId={session.id}
        />
      </div>

      {gpsState !== "live" && session.role === "driver" ? (
        <div className="absolute top-[5.5rem] right-3 z-50 max-w-[17rem] rounded-xl border border-[#00a4e8]/40 bg-[#151a45] p-3 text-xs leading-5 text-white shadow-lg">
          <div className="font-semibold text-[#7dd8f7]">
            {gpsState === "simulated" ? "Not your real position" : "Waiting for your GPS"}
          </div>
          <p className="mt-1 text-blue-100">
            {gpsHint || "Allow location so the YOU pin is this phone, not the training city."}
          </p>
          <Button
            size="sm"
            className="mt-2 h-8 w-full rounded-lg"
            onClick={() => requestGps(session)}
          >
            Use my real GPS
          </Button>
          {gpsState !== "simulated" ? (
            <button
              type="button"
              className="mt-2 w-full text-center text-[11px] text-blue-200/70 underline"
              onClick={() => startSimulation(session)}
            >
              Use training route instead
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute right-3 bottom-28 z-50 flex flex-col gap-2">
        <Button
          variant="secondary"
          className="pointer-events-auto h-11 rounded-full bg-[#151a45] px-3 text-white shadow-lg"
          onClick={() => setPhoneOpen(true)}
        >
          <Smartphone className="size-4" />
          Phone
        </Button>
        <Button
          variant="secondary"
          className="pointer-events-auto h-11 rounded-full bg-[#151a45] px-3 text-white shadow-lg"
          onClick={() => void toggleDemo()}
        >
          <Route className="size-4" />
          {demo ? "Stop demo" : "Demo fleet"}
        </Button>
        {hasFix ? (
          <Button
            size="icon"
            variant="secondary"
            className="pointer-events-auto size-11 rounded-full bg-[#151a45] text-white shadow-lg"
            onClick={() => {
              setSelectedId(session.id);
              setStickToMe(true);
              setRecenterKey((value) => value + 1);
            }}
          >
            <Crosshair className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto rounded-3xl border border-white/20 bg-[#151a45] p-4 text-white shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                {session.callSign} · {session.driverName}
              </div>
              <div className="text-xs text-blue-100">
                {session.role === "driver" ? "Broadcasting this device" : "Dispatch console"}
                {gpsState === "live"
                  ? ` · real GPS${myPos?.accuracy != null ? ` ±${Math.round(myPos.accuracy)}m` : ""}`
                  : gpsState === "simulated"
                    ? " · FAKE training GPS"
                    : gpsState === "waiting"
                      ? " · getting GPS…"
                      : ""}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Sheet open={phoneOpen} onOpenChange={setPhoneOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle>Open on another phone</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-6">
                    <PhoneAccess compact />
                  </div>
                </SheetContent>
              </Sheet>
              <Sheet open={jobsOpen} onOpenChange={setJobsOpen}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-xl"
                  onClick={() => setJobsOpen(true)}
                >
                  <ClipboardList />
                  Courses
                  {myJobs.length > 0 ? ` (${myJobs.length})` : ""}
                </Button>
                <SheetContent side="bottom" className="h-[70dvh] rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle>Vos courses</SheetTitle>
                  </SheetHeader>
                  <div className="overflow-y-auto px-4 pb-6">
                    {myJobs.length === 0 ? (
                      <p className="py-8 text-sm text-muted-foreground">
                        Le bureau n’a pas encore attribué de course à ce véhicule.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {myJobs.map((job) => (
                          <li key={job.id} className="rounded-2xl border border-border bg-card p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold">{job.reference}</div>
                              <Badge>{COURSE_STATUS_LABEL[job.status]}</Badge>
                            </div>
                            <div className="mt-1 text-sm">{job.clientName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {job.pickupAddress} → {job.dropoffAddress}
                            </div>
                            {job.notes ? <div className="mt-1 text-xs">{job.notes}</div> : null}
                            <div className="mt-3 flex gap-2">
                              {job.status === "assigned" ? (
                                <Button size="sm" onClick={() => void patchCourse(job.id, "en_route")}>
                                  Démarrer
                                </Button>
                              ) : null}
                              {job.status === "en_route" ? (
                                <Button size="sm" onClick={() => void patchCourse(job.id, "done")}>
                                  Terminer
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Sheet open={fleetOpen} onOpenChange={setFleetOpen}>
                <Button
                  size="sm"
                  className="rounded-xl"
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
                                {device.id.startsWith("demo-") ? (
                                  <Badge variant="outline">Training</Badge>
                                ) : device.simulated ? (
                                  <Badge variant="outline">Fake GPS</Badge>
                                ) : null}
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
          </div>

          {currentJob ? (
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs text-blue-50">
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>
                  {currentJob.reference} · {COURSE_STATUS_LABEL[currentJob.status]}
                </span>
              </div>
              <div className="mt-1 text-blue-100">{currentJob.clientName}</div>
              <div className="mt-1 text-blue-100">
                {currentJob.pickupAddress} → {currentJob.dropoffAddress}
              </div>
              <div className="mt-2 flex gap-2">
                {currentJob.status === "assigned" ? (
                  <Button
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => void patchCourse(currentJob.id, "en_route")}
                  >
                    Démarrer la course
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => void patchCourse(currentJob.id, "done")}
                  >
                    Course terminée
                  </Button>
                )}
              </div>
            </div>
          ) : selected ? (
            <div className="rounded-2xl bg-white/10 px-3 py-2 text-xs text-blue-50">
              <div className="flex items-center gap-2 font-medium">
                <BusFront className="size-3.5" />
                {selected.callSign} selected
              </div>
              <div className="mt-1 text-blue-100">
                {selected.driverName} · {statusLabel(selected, now)}
                {selected.lat != null
                  ? ` · ${selected.lat.toFixed(4)}, ${selected.lng?.toFixed(4)}`
                  : " · no coordinates"}
              </div>
            </div>
          ) : (
            <p className="text-xs text-blue-100">
              Tap a marker or open Fleet to inspect a vehicle. Start demo vehicles if you are testing without extra phones.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
