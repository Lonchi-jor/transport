"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Crosshair, History, LogOut, Smartphone, X } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FleetMap from "@/components/fleet-map";
import JoinScreen, { type JoinPayload } from "@/components/join-screen";
import PhoneAccess from "@/components/phone-access";
import DeliveryPhoto from "@/components/delivery-photo";
import DispatchNote from "@/components/dispatch-note";
import NotificationBell from "@/components/notification-bell";
import type { AppNotification, Course, FleetDevice, FleetSnapshot } from "@/lib/types";
import {
  COURSE_STATUS_LABEL,
  courseElapsedLabel,
  courseStops,
  courseToMapRoute,
  formatKm,
  formatWhen,
  tourLine,
  vehicleLine,
  type MapRoute,
} from "@/lib/format";
import { CourseItinerary } from "@/components/course-itinerary";
import { Input } from "@/components/ui/input";
import { inProgressJobForDriver, liveJobsForDriver, startBlockedMessage } from "@/lib/assignment";

const SESSION_KEY = "transitlive-session";

type Session = JoinPayload;

type Props = {
  googleMapsApiKey: string;
};

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.id) return null;
    return {
      ...parsed,
      vehiclePlate: parsed.vehiclePlate ?? "",
    };
  } catch {
    return null;
  }
}

function driverApi(path: string, driverId: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}driver=${encodeURIComponent(driverId)}`;
}

function roundCoord(value: number) {
  return value.toFixed(4);
}

export default function FleetApp({ googleMapsApiKey }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [now, setNow] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<"idle" | "live" | "denied" | "waiting">("idle");
  const [gpsHint, setGpsHint] = useState("");
  const [online, setOnline] = useState(true);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [jobsView, setJobsView] = useState<"now" | "history">("now");
  const jobsListRef = useRef<HTMLDivElement>(null);
  const [bnOpen, setBnOpen] = useState(false);
  const [bnValue, setBnValue] = useState("");
  const [bnError, setBnError] = useState("");
  const [bnJobId, setBnJobId] = useState<string | null>(null);
  const [bnNoteAck, setBnNoteAck] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [hasFix, setHasFix] = useState(false);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [stickToMe, setStickToMe] = useState(true);
  const [recenterKey, setRecenterKey] = useState(0);
  const [liveRoute, setLiveRoute] = useState<MapRoute | null>(null);
  const watchId = useRef<number | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; heading: number | null; speedMps: number | null; accuracy: number | null } | null>(null);
  const gpsModeRef = useRef<"idle" | "live" | "denied" | "waiting">("idle");
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
    const me = sessionRef.current;
    const mine = me
      ? (snapshot.devices ?? []).filter((device) => device.id === me.id && device.role === "driver")
      : [];
    const myCourses = me
      ? (snapshot.courses ?? []).filter(
          (course) =>
            course.assignedDeviceId === me.id &&
            (course.status === "assigned" ||
              course.status === "en_route" ||
              course.status === "done" ||
              course.status === "cancelled"),
        )
      : [];
    const myNotes = me
      ? (snapshot.notifications ?? []).filter((item) => item.targetId === me.id)
      : [];
    setDevices(mine);
    setCourses(myCourses);
    setNotifications(myNotes);
    setNow(snapshot.now);
    setOnline(true);
    if (snapshot.drivers) {
      setSession((current) => {
        if (!current) return current;
        const account = snapshot.drivers?.find((driver) => driver.id === current.id);
        if (!account) return current;
        const vehiclePlate = account.vehiclePlate ?? current.vehiclePlate;
        if (
          current.callSign === account.callSign &&
          current.driverName === account.driverName &&
          current.vehicleType === account.vehicleType &&
          current.vehiclePlate === vehiclePlate
        ) {
          return current;
        }
        const next: Session = {
          ...current,
          callSign: account.callSign,
          driverName: account.driverName,
          vehicleType: account.vehicleType,
          vehiclePlate,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const markAlertsRead = useCallback(
    async (ids: string[]) => {
      const targetId = sessionRef.current?.id;
      if (!ids.length || !targetId) return;
      setNotifications((prev) => prev.filter((item) => !ids.includes(item.id)));
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, targetId }),
        });
        if (res.ok) applySnapshot((await res.json()) as FleetSnapshot);
      } catch {
        /* keep optimistic */
      }
    },
    [applySnapshot],
  );

  const sendHeartbeat = useCallback(async (current: Session) => {
    const fix = lastFix.current;
    const body = {
      id: current.id,
      callSign: current.callSign,
      driverName: current.driverName,
      vehicleType: current.vehicleType,
      vehiclePlate: current.vehiclePlate,
      role: current.role,
      sharing: current.role === "driver" && Boolean(fix),
      simulated: false,
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
      if (res.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
        lastFix.current = null;
        setHasFix(false);
        setMyPos(null);
        gpsModeRef.current = "idle";
        setGpsState("idle");
        setSession(null);
        return;
      }
      if (!res.ok) throw new Error("heartbeat failed");
      const snapshot = (await res.json()) as FleetSnapshot;
      applySnapshot(snapshot);
    } catch {
      setOnline(false);
    }
  }, [applySnapshot]);

  const applyRealFix = useCallback(
    (pos: GeolocationPosition, current: Session) => {
      const firstLive = gpsModeRef.current !== "live";
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
      if (firstLive) setStickToMe(true);
      setMyPos({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      });
      void sendHeartbeat(current);
    },
    [sendHeartbeat],
  );

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

    const source = new EventSource(driverApi("/api/fleet/stream", session.id));
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
      return;
    }
    const timer = window.setTimeout(() => {
      if (gpsModeRef.current === "idle") {
        requestGps(session);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session, requestGps]);

  function join(payload: JoinPayload) {
    const next: Session = { ...payload };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    requestGps(next);
    setSession(next);
  }

  async function leave() {
    if (!session) return;
    await fetch(driverApi(`/api/fleet?id=${encodeURIComponent(session.id)}`, session.id), {
      method: "DELETE",
    });
    sessionStorage.removeItem(SESSION_KEY);
    lastFix.current = null;
    setHasFix(false);
    setMyPos(null);
    setLiveRoute(null);
    setGpsHint("");
    gpsModeRef.current = "idle";
    setSession(null);
    setDevices([]);
    setCourses([]);
    setNotifications([]);
    setGpsState("idle");
  }

  async function patchCourse(id: string, body: { status?: string; bnNumber?: string }) {
    const driverId = sessionRef.current?.id;
    const res = await fetch(driverId ? driverApi(`/api/courses/${id}`, driverId) : `/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as FleetSnapshot & { error?: string };
    if (!res.ok) {
      setBnError(data.error || "Impossible de démarrer.");
      return;
    }
    applySnapshot(data);
    setBnOpen(false);
    setBnValue("");
    setBnError("");
  }

  function askBn(jobId: string) {
    const job = courses.find((course) => course.id === jobId);
    if (job && session?.id) {
      const blocking = inProgressJobForDriver(courses, session.id, job.id);
      if (blocking) {
        setBnError(startBlockedMessage(blocking, job.reference));
        return;
      }
    }
    setBnJobId(jobId);
    setBnValue("");
    setBnError("");
    setBnNoteAck(false);
    setBnOpen(true);
  }

  function askDelivery(jobId: string) {
    setJobsOpen(false);
    setScanJobId(jobId);
    setScanOpen(true);
  }

  async function submitDeliveryScan(blob: Blob) {
    if (!scanJobId) return;
    const driverId = sessionRef.current?.id;
    const form = new FormData();
    form.append("file", blob, "bon-livraison.jpg");
    form.append("complete", "true");
    const res = await fetch(
      driverId ? driverApi(`/api/courses/${scanJobId}/delivery`, driverId) : `/api/courses/${scanJobId}/delivery`,
      { method: "POST", body: form },
    );
    const data = (await res.json()) as FleetSnapshot & { error?: string };
    if (!res.ok) throw new Error(data.error || "Impossible de joindre le bon de livraison.");
    applySnapshot(data);
    setScanOpen(false);
    setScanJobId(null);
  }

  const sessionId = session?.id ?? null;
  const myJobs = useMemo(() => {
    if (!sessionId) return [];
    return liveJobsForDriver(courses, sessionId);
  }, [courses, sessionId]);
  const myHistory = useMemo(
    () =>
      courses
        .filter(
          (course) =>
            course.assignedDeviceId === sessionId &&
            (course.status === "done" || course.status === "cancelled"),
        )
        .sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt)),
    [courses, sessionId],
  );
  const runningJob = myJobs.find((job) => job.status === "en_route") ?? null;
  const currentJob = runningJob ?? myJobs[0] ?? null;
  const queuedJob = myJobs.find((job) => job.id !== currentJob?.id) ?? null;
  const blockingStart = runningJob;
  const myAlerts = useMemo(
    () =>
      notifications.filter(
        (item) => item.kind === "course_assigned" && item.targetId === session?.id && !item.readAt,
      ),
    [notifications, session?.id],
  );

  useEffect(() => {
    jobsListRef.current?.scrollTo({ top: 0 });
  }, [jobsView, jobsOpen]);
  const bnJob = courses.find((course) => course.id === bnJobId) ?? null;
  const follow = useMemo(() => {
    if (!myPos) return null;
    return { lat: myPos.lat, lng: myPos.lng };
  }, [myPos]);
  const onUserPan = useCallback(() => setStickToMe(false), []);
  const mapProvider = googleMapsApiKey ? "Google Maps" : "OpenStreetMap";

  const fromKey =
    runningJob && myPos
      ? `${roundCoord(myPos.lat)},${roundCoord(myPos.lng)}`
      : runningJob?.pickupLat != null && runningJob.pickupLng != null
        ? `p:${roundCoord(runningJob.pickupLat)},${roundCoord(runningJob.pickupLng)}`
        : "";
  const destKey = runningJob
    ? `${runningJob.id}:${courseStops(runningJob)
        .map((stop) => `${stop.lat},${stop.lng}`)
        .join("|")}`
    : "";

  useEffect(() => {
    if (!runningJob) {
      setLiveRoute(null);
      return;
    }
    const stops = courseStops(runningJob).filter(
      (stop) => stop.lat != null && stop.lng != null,
    );
    if (!stops.length) {
      setLiveRoute(null);
      return;
    }
    const fromLat = myPos?.lat ?? runningJob.pickupLat;
    const fromLng = myPos?.lng ?? runningJob.pickupLng;
    if (fromLat == null || fromLng == null) return;
    const last = stops[stops.length - 1];
    const points = [{ lat: fromLat, lng: fromLng }, ...stops.map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number }))];
    const dropLabel = last.address;
    const fromLabel = myPos ? "Votre position" : runningJob.pickupAddress;
    const mappedStops = stops.map((stop) => ({
      lat: stop.lat as number,
      lng: stop.lng as number,
      label: stop.address,
    }));
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/routes?points=${encodeURIComponent(points.map((point) => `${point.lat},${point.lng}`).join("|"))}`,
        );
        const data = (await res.json()) as { path?: [number, number][] };
        if (cancelled) return;
        const path =
          data.path && data.path.length >= 2
            ? data.path
            : points.map((point) => [point.lat, point.lng] as [number, number]);
        setLiveRoute({
          path,
          pickup: { lat: fromLat, lng: fromLng, label: fromLabel },
          dropoff: { lat: last.lat as number, lng: last.lng as number, label: dropLabel },
          stops: mappedStops,
        });
      } catch {
        if (cancelled) return;
        setLiveRoute({
          path: points.map((point) => [point.lat, point.lng] as [number, number]),
          pickup: { lat: fromLat, lng: fromLng, label: fromLabel },
          dropoff: { lat: last.lat as number, lng: last.lng as number, label: dropLabel },
          stops: mappedStops,
        });
      }
    };
    const timer = window.setTimeout(() => void run(), myPos ? 700 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // destKey / fromKey already encode the coordinates that should retrigger a route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destKey, fromKey]);

  const mapRoute = runningJob
    ? liveRoute && liveRoute.dropoff.label === runningJob.dropoffAddress
      ? liveRoute
      : courseToMapRoute(runningJob)
    : null;

  const mapDevices = useMemo(() => {
    if (!session) return [];
    const fromServer = devices.find((device) => device.id === session.id);
    if (!myPos) {
      return fromServer && fromServer.lat != null && fromServer.lng != null ? [fromServer] : [];
    }
    return [
      {
        id: session.id,
        callSign: session.callSign,
        driverName: session.driverName,
        phone: fromServer?.phone ?? null,
        vehicleType: session.vehicleType,
        vehiclePlate: session.vehiclePlate,
        role: "driver" as const,
        lat: myPos.lat,
        lng: myPos.lng,
        heading: fromServer?.heading ?? null,
        speedMps: fromServer?.speedMps ?? null,
        accuracy: myPos.accuracy,
        sharing: true,
        simulated: false,
        lastSeen: now,
      },
    ];
  }, [devices, session, myPos, now]);

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
            {online ? "En ligne" : "Hors ligne"} · {mapProvider}
          </div>
        </div>
        <div className="pointer-events-auto flex items-start gap-2">
          <NotificationBell
            tone="dark"
            mode="sheet"
            items={myAlerts}
            label="Vos courses"
            empty="Pas de nouvelle course pour le moment."
            hint="Une alerte apparaît ici quand le bureau vous donne une course."
            onMarkRead={(ids) => void markAlertsRead(ids)}
            onOpenItem={() => {
              setJobsView("now");
              setJobsOpen(true);
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void leave()}
            className="h-9 rounded-xl"
          >
            <LogOut />
            Leave
          </Button>
        </div>
      </header>

      <Sheet open={bnOpen} onOpenChange={setBnOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Lire la note, puis le BN</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {bnJob?.notes ? (
              <>
                <DispatchNote notes={bnJob.notes} />
                <label className="flex items-start gap-2 text-sm leading-5">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[#00a4e8]"
                    checked={bnNoteAck}
                    onChange={(event) => setBnNoteAck(event.target.checked)}
                  />
                  <span>J’ai lu la note du dispatch. Elle m’est adressée.</span>
                </label>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                La course est reçue. Entrez le numéro du bon (BN) pour la démarrer et suivre l’itinéraire.
              </p>
            )}
            <Input
              value={bnValue}
              onChange={(event) => setBnValue(event.target.value)}
              placeholder="Ex. BN-45821"
              autoCapitalize="characters"
            />
            {bnError ? <p className="text-sm text-red-600">{bnError}</p> : null}
            <Button
              className="h-11 w-full"
              disabled={Boolean(bnJob?.notes?.trim()) && !bnNoteAck}
              onClick={() => {
                if (!bnJobId) return;
                if (bnJob?.notes?.trim() && !bnNoteAck) {
                  setBnError("Lisez la note du dispatch avant de démarrer.");
                  return;
                }
                if (!bnValue.trim()) {
                  setBnError("Le numéro du BN est obligatoire.");
                  return;
                }
                void patchCourse(bnJobId, { status: "en_route", bnNumber: bnValue });
              }}
            >
              Valider le BN et démarrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <DeliveryPhoto
        key={scanOpen ? scanJobId ?? "photo" : "closed"}
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onConfirm={submitDeliveryScan}
      />

      <div className="absolute inset-0 z-0 isolate">
        <FleetMap
          googleMapsApiKey={googleMapsApiKey}
          devices={mapDevices}
          now={now}
          selectedId={selectedId ?? session.id}
          onSelect={setSelectedId}
          follow={follow}
          stickToMe={stickToMe}
          recenterKey={recenterKey}
          onUserPan={onUserPan}
          selfId={session.id}
          route={mapRoute}
          frameSelfAndRoute={Boolean(mapRoute)}
        />
      </div>

      {gpsState !== "live" && session.role === "driver" ? (
        <div className="absolute top-[5.5rem] right-3 z-50 max-w-[17rem] rounded-xl border border-[#00a4e8]/40 bg-[#151a45] p-3 text-xs leading-5 text-white shadow-lg">
          <div className="font-semibold text-[#7dd8f7]">En attente du GPS</div>
          <p className="mt-1 text-blue-100">
            {gpsHint || "Autorisez la localisation : le pin suit uniquement le GPS de ce téléphone."}
          </p>
          <Button
            size="sm"
            className="mt-2 h-8 w-full rounded-lg"
            onClick={() => requestGps(session)}
          >
            Activer ma géolocalisation
          </Button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col items-end gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex flex-col gap-2">
          <Button
            variant="secondary"
            className="h-11 rounded-full bg-[#151a45] px-3 text-white shadow-lg"
            onClick={() => setPhoneOpen(true)}
          >
            <Smartphone className="size-4" />
            Phone
          </Button>
          {hasFix ? (
            <Button
              size="icon"
              variant="secondary"
              className="size-11 rounded-full bg-[#151a45] text-white shadow-lg"
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

        <div className="pointer-events-auto w-full overflow-hidden rounded-3xl border border-white/20 bg-[#151a45] text-white shadow-2xl">
          <button
            type="button"
            onClick={() => setDockOpen((open) => !open)}
            className="flex w-full flex-col px-4 pt-2 pb-2.5 text-left"
            aria-expanded={dockOpen}
            aria-label={dockOpen ? "Baisser le panneau" : "Remonter le panneau"}
          >
            <span className="mx-auto h-1 w-10 rounded-full bg-white/40" />
            <div className="mt-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {session.callSign} · {session.driverName}
                </div>
                {!dockOpen ? (
                  <div className="truncate text-[11px] text-blue-100">
                    {currentJob
                      ? `${currentJob.reference} · ${COURSE_STATUS_LABEL[currentJob.status]}${
                          queuedJob ? ` · puis ${queuedJob.reference}` : ""
                        }`
                      : vehicleLine(session)}
                  </div>
                ) : null}
              </div>
              {dockOpen ? (
                <ChevronDown className="size-5 shrink-0 text-blue-100" />
              ) : (
                <ChevronUp className="size-5 shrink-0 text-[#7dd8f7]" />
              )}
            </div>
          </button>

          {dockOpen ? (
            <div className="px-4 pb-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-blue-100">{vehicleLine(session)}</div>
                  <div className="text-xs text-blue-100">
                    {session.role === "driver" ? "En ligne" : "Dispatch"}
                    {gpsState === "live"
                      ? ` · GPS${myPos?.accuracy != null ? ` ±${Math.round(myPos.accuracy)} m` : ""}`
                      : gpsState === "waiting"
                        ? " · GPS…"
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
                  <Sheet
                    open={jobsOpen}
                    onOpenChange={(open) => {
                      setJobsOpen(open);
                      if (open) setJobsView("now");
                    }}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => {
                        setJobsView("now");
                        setJobsOpen(true);
                      }}
                    >
                      <ClipboardList />
                      Courses
                      {myJobs.length > 0 ? ` (${myJobs.length})` : ""}
                    </Button>
                    <SheetContent
                      side="bottom"
                      showCloseButton={false}
                      className="flex max-h-[min(70dvh,calc(100dvh-6.5rem))] flex-col gap-0 overflow-hidden rounded-t-3xl p-0 data-[side=bottom]:h-[min(70dvh,calc(100dvh-6.5rem))] data-[side=bottom]:max-h-[min(70dvh,calc(100dvh-6.5rem))]"
                    >
                      <div className="sticky top-0 z-20 shrink-0 border-b border-[#d5dcf0] bg-white">
                        <SheetHeader className="p-3 pb-2">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <SheetTitle>
                                {jobsView === "history" ? "Historique" : "Courses attribuées"}
                              </SheetTitle>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                {jobsView === "history"
                                  ? "Faites défiler vos courses terminées. La croix ferme et ramène à la carte."
                                  : "Uniquement la course (ou les deux) que le bureau vous a donnée maintenant."}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label="Fermer et revenir à la carte"
                              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#d5dcf0] bg-[#f4f7fc] text-[#2b308f] shadow-sm"
                              onClick={() => setJobsOpen(false)}
                            >
                              <X className="size-5" />
                            </button>
                          </div>
                        </SheetHeader>
                        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                          <button
                            type="button"
                            onClick={() => setJobsView("now")}
                            className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${
                              jobsView === "now"
                                ? "bg-[#2b308f] text-white"
                                : "bg-[#eef3fb] text-[#5b6294]"
                            }`}
                          >
                            Maintenant
                            <div className="mt-0.5 font-normal opacity-90">
                              {myJobs.length === 0
                                ? "Aucune attribuée"
                                : `${myJobs.length} attribuée${myJobs.length > 1 ? "s" : ""}`}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setJobsView("history")}
                            className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold ${
                              jobsView === "history"
                                ? "bg-[#2b308f] text-white"
                                : "bg-[#eef3fb] text-[#5b6294]"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <History className="size-3.5" />
                              Historique
                            </span>
                            <div className="mt-0.5 font-normal opacity-90">
                              {myHistory.length === 0
                                ? "Pas encore"
                                : `${myHistory.length} terminée${myHistory.length > 1 ? "s" : ""}`}
                            </div>
                          </button>
                        </div>
                      </div>
                      <div
                        ref={jobsListRef}
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
                      >
                        {jobsView === "now" ? (
                          myJobs.length === 0 ? (
                            <p className="py-8 text-sm text-muted-foreground">
                              Aucune course ne vous est attribuée pour le moment. Le bureau vous en enverra une.
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {myJobs.map((job) => (
                                <li key={job.id} className="rounded-2xl border border-border bg-card p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-semibold text-[#2b308f]">{job.reference}</div>
                                    <Badge>{COURSE_STATUS_LABEL[job.status]}</Badge>
                                  </div>
                                  <div className="mt-1 text-sm">{job.clientName}</div>
                                  {job.clientPhone ? (
                                    <div className="mt-0.5 text-xs text-muted-foreground">{job.clientPhone}</div>
                                  ) : null}
                                  <div className="mt-2">
                                    <CourseItinerary course={job} />
                                  </div>
                                  <div className="mt-2 text-xs text-[#2b308f]">{vehicleLine(job)}</div>
                                  {formatKm(job.distanceMeters) ? (
                                    <div className="mt-1 text-xs text-muted-foreground">{formatKm(job.distanceMeters)}</div>
                                  ) : null}
                                  {job.notes ? (
                                    <div className="mt-2">
                                      <DispatchNote notes={job.notes} />
                                    </div>
                                  ) : null}
                                  <div className="mt-3 flex flex-col gap-2">
                                    {job.status === "assigned" && blockingStart ? (
                                      <p className="text-xs leading-5 text-amber-800">
                                        {startBlockedMessage(blockingStart, job.reference)}
                                      </p>
                                    ) : null}
                                    {job.status === "assigned" && !blockingStart ? (
                                      <Button size="sm" className="h-10" onClick={() => askBn(job.id)}>
                                        Démarrer
                                      </Button>
                                    ) : null}
                                    {job.status === "en_route" ? (
                                      <Button size="sm" className="h-10" onClick={() => askDelivery(job.id)}>
                                        Terminer — photo du BL
                                      </Button>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )
                        ) : myHistory.length === 0 ? (
                          <p className="py-8 text-sm text-muted-foreground">
                            Pas encore de course terminée pour vous. L’historique n’affiche que vos propres courses.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {myHistory.map((job) => (
                              <li key={job.id} className="rounded-2xl border border-[#e4e8f4] bg-white px-3 py-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-semibold text-[#2b308f]">{job.reference}</div>
                                    <div className="truncate text-sm">{job.clientName}</div>
                                    <div className="mt-0.5 truncate text-xs text-[#5b6294]">
                                      <CourseItinerary course={job} compact />
                                    </div>
                                  </div>
                                  <Badge variant="secondary" className="shrink-0">
                                    {COURSE_STATUS_LABEL[job.status]}
                                  </Badge>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] leading-4 text-[#5b6294]">
                                  <span>{vehicleLine(job)}</span>
                                  {job.bnNumber ? <span>BN {job.bnNumber}</span> : null}
                                  {formatKm(job.distanceMeters) ? <span>{formatKm(job.distanceMeters)}</span> : null}
                                  {courseElapsedLabel(job, now) ? (
                                    <span className="font-medium text-[#2b308f]">{courseElapsedLabel(job, now)}</span>
                                  ) : null}
                                  {formatWhen(job.finishedAt ?? job.updatedAt) ? (
                                    <span>{formatWhen(job.finishedAt ?? job.updatedAt)}</span>
                                  ) : null}
                                </div>
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
                    {tourLine(currentJob)}
                  </div>
                  {currentJob.bnNumber ? (
                    <div className="mt-1 font-medium text-white">BN {currentJob.bnNumber}</div>
                  ) : null}
                  {currentJob.notes ? (
                    <div className="mt-2">
                      <DispatchNote notes={currentJob.notes} tone="dark" />
                    </div>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    {currentJob.status === "assigned" ? (
                      <Button
                        size="sm"
                        className="h-8 rounded-lg"
                        onClick={() => askBn(currentJob.id)}
                      >
                        Commencer — saisir le BN
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 rounded-lg"
                        onClick={() => askDelivery(currentJob.id)}
                      >
                        Terminer — photo du BL
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-blue-100">
                  En attente d’une course du bureau.
                </p>
              )}
              {queuedJob ? (
                <div className="mt-2 rounded-2xl border border-white/15 bg-black/20 px-3 py-2 text-xs text-blue-50">
                  <div className="font-medium text-[#7dd8f7]">Prochaine course · {queuedJob.reference}</div>
                  <div className="mt-1 text-blue-100">{queuedJob.clientName}</div>
                  <div className="mt-1 text-blue-100">
                    {tourLine(queuedJob)}
                  </div>
                  {queuedJob.notes ? (
                    <div className="mt-2">
                      <DispatchNote notes={queuedJob.notes} tone="dark" />
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] leading-4 text-amber-100">
                    {currentJob?.status === "en_route"
                      ? startBlockedMessage(currentJob, queuedJob.reference)
                      : "Visible dès maintenant. Vous la démarrerez après la course en cours."}
                  </p>
                </div>
              ) : null}
            </div>
          ) : currentJob ? (
            <div className="flex items-center justify-between gap-2 px-4 pb-3">
              {currentJob.status === "assigned" ? (
                <Button
                  size="sm"
                  className="h-8 flex-1 rounded-lg"
                  onClick={() => askBn(currentJob.id)}
                >
                  Commencer — BN
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-8 flex-1 rounded-lg"
                  onClick={() => askDelivery(currentJob.id)}
                >
                  Terminer — BL
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
