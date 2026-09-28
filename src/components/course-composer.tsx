"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, Plus, Trash2, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PhoneLink, VehicleFields, DriverAssignSelect } from "@/components/admin-fields";
import PlaceSuggest from "@/components/place-suggest";
import type { Course, CourseStop, FleetSnapshot, VehicleType } from "@/lib/types";
import { MAX_TOUR_STOPS } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import type { PlaceHit } from "@/lib/geo";
import { ensureDispatcherId } from "@/lib/dispatcher";
import { assignmentBlockedMessage, isDriverAtCapacity, liveJobsForDriver } from "@/lib/assignment";

const CourseComposerMap = dynamic(() => import("@/components/course-composer-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#d9e4d6] text-sm text-[#5b6294]">
      Chargement de la carte…
    </div>
  ),
});

type DraftStop = CourseStop;

export type CourseDraftForm = {
  clientName: string;
  clientPhone: string;
  pickupAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  stops: DraftStop[];
  notes: string;
  scheduledAt: string;
  assignedDeviceId: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  trailerPlates: string[];
};

type PinFocus = "voyage" | string;

function emptyStop(): DraftStop {
  return { id: crypto.randomUUID(), address: "", lat: null, lng: null };
}

function nextTourFocus(stops: DraftStop[]): PinFocus {
  return (
    stops.find((stop) => !stop.address.trim() || stop.lat == null)?.id ??
    stops[stops.length - 1]?.id ??
    "voyage"
  );
}

export const emptyCourseDraft: CourseDraftForm = {
  clientName: "",
  clientPhone: "",
  pickupAddress: "",
  pickupLat: null,
  pickupLng: null,
  stops: [],
  notes: "",
  scheduledAt: "",
  assignedDeviceId: "",
  vehicleType: "van",
  vehiclePlate: "",
  trailerPlates: [],
};

type Props = {
  open: boolean;
  onClose: () => void;
  roster: RosterDriver[];
  courses: Course[];
  liveById: Map<string, unknown>;
  onCreated: (snapshot: FleetSnapshot) => void;
};

async function lookupAddress(lat: number, lng: number): Promise<PlaceHit> {
  try {
    const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`);
    const data = (await res.json()) as { place?: PlaceHit };
    if (data.place?.label) return { label: data.place.label, lat, lng };
  } catch {
    /* keep coords */
  }
  return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
}

export default function CourseComposer({ open, onClose, roster, courses, liveById, onCreated }: Props) {
  const [form, setForm] = useState<CourseDraftForm>({ ...emptyCourseDraft, stops: [emptyStop()] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinFocus, setPinFocus] = useState<PinFocus>("voyage");
  const [pickupFromPin, setPickupFromPin] = useState(false);
  const [stopFromPin, setStopFromPin] = useState<Record<string, boolean>>({});
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [flyKey, setFlyKey] = useState(0);
  const [fetchedPath, setFetchedPath] = useState<[number, number][] | null>(null);
  const [fetchedKey, setFetchedKey] = useState("");

  const assignedDriver = roster.find((item) => item.id === form.assignedDeviceId) ?? null;
  const placedStops = form.stops.filter((stop) => stop.lat != null && stop.lng != null);
  const requestKey =
    form.pickupLat != null && form.pickupLng != null && placedStops.length > 0
      ? `${form.pickupLat},${form.pickupLng}|${placedStops.map((stop) => `${stop.lat},${stop.lng}`).join("|")}`
      : "";
  const tourSummary =
    placedStops.length > 1
      ? `${placedStops.length} destinations`
      : placedStops[0]?.address || form.stops[0]?.address || "Recherche ou clic sur la carte";
  const routePath = fetchedKey === requestKey ? fetchedPath : null;

  const goTo = useCallback((lat: number, lng: number) => {
    setFlyTo({ lat, lng });
    setFlyKey((value) => value + 1);
  }, []);

  function fillVehicleFromDriver(driverId: string) {
    const driver = roster.find((item) => item.id === driverId);
    if (!driver) {
      setError("");
      setForm((current) => ({
        ...current,
        assignedDeviceId: "",
        vehicleType: "van",
        vehiclePlate: "",
        trailerPlates: [],
      }));
      return;
    }
    const held = liveJobsForDriver(courses, driver.id);
    if (isDriverAtCapacity(courses, driver.id)) {
      setError(assignmentBlockedMessage(held, driver.callSign));
      setForm((current) => ({
        ...current,
        assignedDeviceId: "",
        vehicleType: "van",
        vehiclePlate: "",
        trailerPlates: [],
      }));
      return;
    }
    setError("");
    setForm((current) => ({
      ...current,
      assignedDeviceId: driver.id,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate ?? "",
      trailerPlates: driver.trailerPlates ?? [],
    }));
  }

  function patchStop(id: string, patch: Partial<DraftStop>) {
    setForm((current) => ({
      ...current,
      stops: current.stops.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)),
    }));
  }

  function pickPickup(place: PlaceHit) {
    setPickupFromPin(true);
    setForm((current) => ({
      ...current,
      pickupAddress: place.label,
      pickupLat: place.lat,
      pickupLng: place.lng,
    }));
    setPinFocus(nextTourFocus(form.stops));
    goTo(place.lat, place.lng);
  }

  function pickStop(id: string, place: PlaceHit) {
    setStopFromPin((current) => ({ ...current, [id]: true }));
    patchStop(id, { address: place.label, lat: place.lat, lng: place.lng });
    goTo(place.lat, place.lng);
  }

  async function placePin(kind: PinFocus, lat: number, lng: number, options: { fly?: boolean; switchFocus?: boolean } = {}) {
    const place = await lookupAddress(lat, lng);
    if (kind === "voyage") {
      setPickupFromPin(true);
      setForm((current) => ({
        ...current,
        pickupAddress: place.label,
        pickupLat: lat,
        pickupLng: lng,
      }));
      if (options.switchFocus !== false) {
        setPinFocus(nextTourFocus(form.stops));
      }
    } else {
      setStopFromPin((current) => ({ ...current, [kind]: true }));
      patchStop(kind, { address: place.label, lat, lng });
    }
    if (options.fly) goTo(lat, lng);
  }

  function addStop() {
    if (form.stops.length >= MAX_TOUR_STOPS) return;
    const next = emptyStop();
    setForm((current) => ({ ...current, stops: [...current.stops, next] }));
    setPinFocus(next.id);
    setError("");
  }

  function removeStop(id: string) {
    if (form.stops.length <= 1) return;
    const next = form.stops.filter((stop) => stop.id !== id);
    setForm((current) => ({ ...current, stops: next }));
    if (pinFocus === id) setPinFocus(next[next.length - 1]?.id ?? "voyage");
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!requestKey) return;
    const points = requestKey.split("|").map((part) => {
      const [lat, lng] = part.split(",").map(Number);
      return { lat, lng };
    });
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/routes?points=${encodeURIComponent(requestKey)}`);
        const data = (await res.json()) as { path?: [number, number][] };
        if (cancelled) return;
        setFetchedPath(
          data.path && data.path.length >= 2
            ? data.path
            : points.map((point) => [point.lat, point.lng] as [number, number]),
        );
        setFetchedKey(requestKey);
      } catch {
        if (cancelled) return;
        setFetchedPath(points.map((point) => [point.lat, point.lng] as [number, number]));
        setFetchedKey(requestKey);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestKey]);

  async function createJob(event: FormEvent) {
    event.preventDefault();
    if (form.pickupLat == null || form.pickupLng == null) {
      setError("Placez le point de voyage sur la carte (recherche ou clic).");
      setPinFocus("voyage");
      return;
    }
    const destinations = form.stops.filter((stop) => stop.address.trim() && stop.lat != null && stop.lng != null);
    if (!destinations.length) {
      setError("Ajoutez au moins une destination au tour de ville.");
      setPinFocus(nextTourFocus(form.stops));
      return;
    }
    if (form.assignedDeviceId) {
      const held = liveJobsForDriver(courses, form.assignedDeviceId);
      if (isDriverAtCapacity(courses, form.assignedDeviceId)) {
        setError(assignmentBlockedMessage(held, assignedDriver?.callSign));
        return;
      }
    }
    const last = destinations[destinations.length - 1];
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName,
          clientPhone: form.clientPhone,
          pickupAddress: form.pickupAddress,
          pickupLat: form.pickupLat,
          pickupLng: form.pickupLng,
          dropoffAddress: last.address,
          dropoffLat: last.lat,
          dropoffLng: last.lng,
          stops: destinations,
          notes: form.notes,
          scheduledAt: form.scheduledAt || null,
          assignedDeviceId: form.assignedDeviceId || null,
          vehicleType: form.assignedDeviceId ? form.vehicleType : null,
          vehiclePlate: form.assignedDeviceId ? form.vehiclePlate : null,
          trailerPlates: form.assignedDeviceId ? form.trailerPlates : [],
          createdByAdminId: ensureDispatcherId(),
        }),
      });
      const data = (await res.json()) as FleetSnapshot & { error?: string };
      if (!res.ok) {
        setError(data.error || "Impossible de créer la course.");
        return;
      }
      onCreated(data);
      onClose();
    } catch {
      setError("Réseau indisponible.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const pickup =
    form.pickupLat != null && form.pickupLng != null
      ? { lat: form.pickupLat, lng: form.pickupLng, label: form.pickupAddress || "Voyage" }
      : null;
  const mapStops = placedStops.map((stop) => ({
    id: stop.id,
    lat: stop.lat as number,
    lng: stop.lng as number,
    label: stop.address || "Destination",
  }));

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0c1028] text-[#1c2268]">
      <header className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div>
          <div className="text-sm font-semibold">Nouvelle course</div>
          <p className="text-[11px] text-blue-200">
            {pinFocus === "voyage"
              ? "Recherchez le point de voyage : la carte s’y rend. Glissez le pin pour l’ajuster."
              : "Placez une destination du tour de ville, ou ajoutez-en une autre."}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="rounded-xl" onClick={onClose}>
          <X className="size-4" />
          Fermer
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        <CourseComposerMap
          pickup={pickup}
          stops={mapStops}
          routePath={routePath}
          flyTo={flyTo}
          flyKey={flyKey}
          onMapClick={(lat, lng) => void placePin(pinFocus, lat, lng, { switchFocus: pinFocus === "voyage" })}
          onPickupMove={(lat, lng) => void placePin("voyage", lat, lng, { switchFocus: false })}
          onStopMove={(id, lat, lng) => void placePin(id, lat, lng, { switchFocus: false })}
        />

        <form
          onSubmit={(event) => void createJob(event)}
          className="absolute inset-x-0 bottom-0 z-20 max-h-[58vh] overflow-y-auto rounded-t-3xl border border-white/15 bg-white p-4 shadow-2xl md:inset-y-3 md:left-3 md:right-auto md:max-h-none md:w-[380px] md:rounded-3xl"
        >
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPinFocus("voyage")}
              className={`flex-1 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                pinFocus === "voyage" ? "bg-[#e7f6fd] text-[#2b308f] ring-2 ring-[#00a4e8]" : "bg-[#f4f7fc] text-[#5b6294]"
              }`}
            >
              1. Voyage
              <div className="mt-0.5 truncate font-normal">
                {pickup ? form.pickupAddress || "Point placé" : "Recherche ou clic sur la carte"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPinFocus(nextTourFocus(form.stops))}
              className={`flex-1 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                pinFocus !== "voyage" ? "bg-[#e7f6fd] text-[#2b308f] ring-2 ring-[#2b308f]" : "bg-[#f4f7fc] text-[#5b6294]"
              }`}
            >
              2. Tour de ville
              <div className="mt-0.5 truncate font-normal">{tourSummary}</div>
            </button>
            <button
              type="button"
              onClick={addStop}
              disabled={form.stops.length >= MAX_TOUR_STOPS}
              aria-label="Ajouter une destination"
              title="Ajouter une destination"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#2b308f] text-white disabled:opacity-40"
            >
              <Plus className="size-5" />
            </button>
          </div>

          <div className="grid gap-3">
            <Field label="Client" htmlFor="composer-client">
              <Input
                id="composer-client"
                required
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                placeholder="Nom du client"
              />
            </Field>
            <Field label="Téléphone" htmlFor="composer-phone">
              <Input
                id="composer-phone"
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                placeholder="+237 6…"
              />
            </Field>
            <Field label="Point de voyage" htmlFor="composer-pickup">
              <PlaceSuggest
                id="composer-pickup"
                required
                suppressLookup={pickupFromPin}
                value={form.pickupAddress}
                placeholder="Point de voyage — adresse ou clic sur la carte"
                onFocus={() => setPinFocus("voyage")}
                onChange={(pickupAddress) => {
                  setPickupFromPin(false);
                  setForm({ ...form, pickupAddress });
                }}
                onSelect={(place) => pickPickup(place)}
              />
            </Field>
            <div className="grid gap-2">
              <div className="text-sm font-medium">Tour de ville</div>
              {form.stops.map((stop, index) => (
                <div key={stop.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Field label={`Destination ${index + 1}`} htmlFor={`composer-stop-${stop.id}`}>
                      <PlaceSuggest
                        id={`composer-stop-${stop.id}`}
                        required={index === 0}
                        suppressLookup={Boolean(stopFromPin[stop.id])}
                        value={stop.address}
                        placeholder={index === 0 ? "Première destination" : "Destination suivante"}
                        onFocus={() => setPinFocus(stop.id)}
                        onChange={(address) => {
                          setStopFromPin((current) => ({ ...current, [stop.id]: false }));
                          patchStop(stop.id, { address });
                        }}
                        onSelect={(place) => pickStop(stop.id, place)}
                      />
                    </Field>
                  </div>
                  {form.stops.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 size-8 shrink-0 text-[#5b6294]"
                      onClick={() => removeStop(stop.id)}
                      aria-label={`Retirer la destination ${index + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                className="h-9 rounded-xl"
                disabled={form.stops.length >= MAX_TOUR_STOPS}
                onClick={addStop}
              >
                <Plus className="size-4" />
                Ajouter une destination
              </Button>
              <p className="text-[11px] leading-4 text-[#5b6294]">
                Posez le voyage, puis les arrêts du tour. Le + ajoute une destination. Cliquez la carte ou glissez un pin
                pour ajuster.
              </p>
            </div>
            <Field label="Heure prévue" htmlFor="composer-when">
              <Input
                id="composer-when"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </Field>
            <Field label="Chauffeur" htmlFor="composer-driver">
              <DriverAssignSelect
                id="composer-driver"
                value={form.assignedDeviceId}
                roster={roster}
                courses={courses}
                liveById={liveById}
                emptyLabel="Attribuer plus tard"
                onChange={fillVehicleFromDriver}
              />
            </Field>
            {form.assignedDeviceId ? (
              <div className="space-y-2">
                <VehicleFields
                  idPrefix="composer-job"
                  vehicleType={form.vehicleType}
                  vehiclePlate={form.vehiclePlate}
                  onChange={(patch) => setForm({ ...form, ...patch })}
                />
                {assignedDriver?.phone ? (
                  <p className="text-xs text-[#5b6294]">
                    Téléphone :{" "}
                    <PhoneLink phone={assignedDriver.phone} className="font-medium text-[#00a4e8] hover:underline" />
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/admin/chauffeurs?id=${encodeURIComponent(form.assignedDeviceId)}`}
                    className="text-xs font-medium text-[#00a4e8] hover:underline"
                  >
                    Fiche chauffeur
                  </Link>
                  <Link
                    href={`/admin/courses?chauffeur=${encodeURIComponent(form.assignedDeviceId)}`}
                    className="text-xs font-medium text-[#00a4e8] hover:underline"
                  >
                    Ses courses
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5b6294]">
                Recherchez un indicatif ou un nom. Les chauffeurs sans course en cours sont en haut, puis ceux qui
                ont déjà une course. Le véhicule se remplit tout seul.{" "}
                <Link href="/admin/chauffeurs" className="text-[#00a4e8] hover:underline">
                  Gérer les chauffeurs
                </Link>
              </p>
            )}
            <Field label="Note au chauffeur" htmlFor="composer-notes">
              <textarea
                id="composer-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Accès, colis, consignes — le chauffeur lira ceci sur son téléphone."
              />
              <p className="text-xs text-[#5b6294]">
                Cette note lui est adressée. Elle s’affiche en grand sur le portable ; il doit la lire avant de démarrer.
              </p>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={saving} className="h-10">
              {saving ? "Envoi…" : "Donner la course"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function NewCourseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#2b308f]/20 bg-[#2b308f] px-4 py-3.5 text-left text-white shadow-sm transition hover:bg-[#23287a]"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
        <Plus className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Nouvelle course</span>
        <span className="mt-0.5 block text-xs text-blue-100">
          Voyage, puis tour de ville — plusieurs destinations
        </span>
      </span>
      <MapPinned className="size-5 shrink-0 text-[#7dd8f7]" />
    </button>
  );
}
