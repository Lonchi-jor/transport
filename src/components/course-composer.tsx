"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, Plus, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PhoneLink, VehicleFields } from "@/components/admin-fields";
import PlaceSuggest from "@/components/place-suggest";
import type { FleetSnapshot, VehicleType } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import type { PlaceHit } from "@/lib/geo";
import { ensureDispatcherId } from "@/lib/dispatcher";

const CourseComposerMap = dynamic(() => import("@/components/course-composer-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#d9e4d6] text-sm text-[#5b6294]">
      Chargement de la carte…
    </div>
  ),
});

export type CourseDraftForm = {
  clientName: string;
  clientPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  notes: string;
  scheduledAt: string;
  assignedDeviceId: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
};

export const emptyCourseDraft: CourseDraftForm = {
  clientName: "",
  clientPhone: "",
  pickupAddress: "",
  dropoffAddress: "",
  pickupLat: null,
  pickupLng: null,
  dropoffLat: null,
  dropoffLng: null,
  notes: "",
  scheduledAt: "",
  assignedDeviceId: "",
  vehicleType: "van",
  vehiclePlate: "",
};

type Props = {
  open: boolean;
  onClose: () => void;
  roster: RosterDriver[];
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

export default function CourseComposer({ open, onClose, roster, liveById, onCreated }: Props) {
  const [form, setForm] = useState<CourseDraftForm>(emptyCourseDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinFocus, setPinFocus] = useState<"pickup" | "dropoff">("pickup");
  const [pickupFromPin, setPickupFromPin] = useState(false);
  const [dropoffFromPin, setDropoffFromPin] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [flyKey, setFlyKey] = useState(0);
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);

  const assignedDriver = roster.find((item) => item.id === form.assignedDeviceId) ?? null;

  const goTo = useCallback((lat: number, lng: number) => {
    setFlyTo({ lat, lng });
    setFlyKey((value) => value + 1);
  }, []);

  function fillVehicleFromDriver(driverId: string) {
    const driver = roster.find((item) => item.id === driverId);
    if (!driver) {
      setForm((current) => ({
        ...current,
        assignedDeviceId: "",
        vehicleType: "van",
        vehiclePlate: "",
      }));
      return;
    }
    setForm((current) => ({
      ...current,
      assignedDeviceId: driver.id,
      vehicleType: driver.vehicleType,
      vehiclePlate: driver.vehiclePlate ?? "",
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
    setPinFocus("dropoff");
    goTo(place.lat, place.lng);
  }

  function pickDropoff(place: PlaceHit) {
    setDropoffFromPin(true);
    setForm((current) => ({
      ...current,
      dropoffAddress: place.label,
      dropoffLat: place.lat,
      dropoffLng: place.lng,
    }));
    goTo(place.lat, place.lng);
  }

  async function placePin(
    kind: "pickup" | "dropoff",
    lat: number,
    lng: number,
    options: { fly?: boolean; switchFocus?: boolean } = {},
  ) {
    const place = await lookupAddress(lat, lng);
    if (kind === "pickup") {
      setPickupFromPin(true);
      setForm((current) => ({
        ...current,
        pickupAddress: place.label,
        pickupLat: lat,
        pickupLng: lng,
      }));
      if (options.switchFocus !== false) setPinFocus("dropoff");
    } else {
      setDropoffFromPin(true);
      setForm((current) => ({
        ...current,
        dropoffAddress: place.label,
        dropoffLat: lat,
        dropoffLng: lng,
      }));
    }
    if (options.fly) goTo(lat, lng);
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
    if (form.pickupLat == null || form.pickupLng == null || form.dropoffLat == null || form.dropoffLng == null) {
      return;
    }
    const fromLat = form.pickupLat;
    const fromLng = form.pickupLng;
    const toLat = form.dropoffLat;
    const toLng = form.dropoffLng;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/routes?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}`,
        );
        const data = (await res.json()) as { path?: [number, number][] };
        if (cancelled) return;
        setRoutePath(data.path && data.path.length >= 2 ? data.path : [[fromLat, fromLng], [toLat, toLng]]);
      } catch {
        if (!cancelled) setRoutePath([[fromLat, fromLng], [toLat, toLng]]);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.pickupLat, form.pickupLng, form.dropoffLat, form.dropoffLng, open]);

  async function createJob(event: FormEvent) {
    event.preventDefault();
    if (form.pickupLat == null || form.pickupLng == null) {
      setError("Placez le point de départ sur la carte (recherche ou clic).");
      setPinFocus("pickup");
      return;
    }
    if (form.dropoffLat == null || form.dropoffLng == null) {
      setError("Placez le point de livraison sur la carte (recherche ou clic).");
      setPinFocus("dropoff");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scheduledAt: form.scheduledAt || null,
          assignedDeviceId: form.assignedDeviceId || null,
          vehicleType: form.assignedDeviceId ? form.vehicleType : null,
          vehiclePlate: form.assignedDeviceId ? form.vehiclePlate : null,
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
      ? { lat: form.pickupLat, lng: form.pickupLng, label: form.pickupAddress || "Départ" }
      : null;
  const dropoff =
    form.dropoffLat != null && form.dropoffLng != null
      ? { lat: form.dropoffLat, lng: form.dropoffLng, label: form.dropoffAddress || "Arrivée" }
      : null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0c1028] text-[#1c2268]">
      <header className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div>
          <div className="text-sm font-semibold">Nouvelle course</div>
          <p className="text-[11px] text-blue-200">
            {pinFocus === "pickup"
              ? "Recherchez le départ : la carte s’y rend. Glissez le pin pour l’ajuster."
              : "Recherchez la livraison, ou glissez le pin Arrivée."}
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
          dropoff={dropoff}
          routePath={routePath}
          flyTo={flyTo}
          flyKey={flyKey}
          onMapClick={(lat, lng) => void placePin(pinFocus, lat, lng, { switchFocus: pinFocus === "pickup" })}
          onPickupMove={(lat, lng) => void placePin("pickup", lat, lng, { switchFocus: false })}
          onDropoffMove={(lat, lng) => void placePin("dropoff", lat, lng, { switchFocus: false })}
        />

        <form
          onSubmit={(event) => void createJob(event)}
          className="absolute inset-x-0 bottom-0 z-20 max-h-[58vh] overflow-y-auto rounded-t-3xl border border-white/15 bg-white p-4 shadow-2xl md:inset-y-3 md:left-3 md:right-auto md:max-h-none md:w-[380px] md:rounded-3xl"
        >
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setPinFocus("pickup")}
              className={`flex-1 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                pinFocus === "pickup" ? "bg-[#e7f6fd] text-[#2b308f] ring-2 ring-[#00a4e8]" : "bg-[#f4f7fc] text-[#5b6294]"
              }`}
            >
              1. Départ
              <div className="mt-0.5 truncate font-normal">
                {pickup ? form.pickupAddress || "Point placé" : "Recherche ou clic sur la carte"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPinFocus("dropoff")}
              className={`flex-1 rounded-xl px-3 py-2 text-left text-xs font-semibold ${
                pinFocus === "dropoff" ? "bg-[#e7f6fd] text-[#2b308f] ring-2 ring-[#2b308f]" : "bg-[#f4f7fc] text-[#5b6294]"
              }`}
            >
              2. Livraison
              <div className="mt-0.5 truncate font-normal">
                {dropoff ? form.dropoffAddress || "Point placé" : "Recherche ou clic sur la carte"}
              </div>
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
            <Field label="Lieu de départ" htmlFor="composer-pickup">
              <PlaceSuggest
                id="composer-pickup"
                required
                suppressLookup={pickupFromPin}
                value={form.pickupAddress}
                placeholder="Tapez une adresse, puis choisissez une suggestion"
                onFocus={() => setPinFocus("pickup")}
                onChange={(pickupAddress) => {
                  setPickupFromPin(false);
                  setForm({ ...form, pickupAddress });
                }}
                onSelect={(place) => pickPickup(place)}
              />
            </Field>
            <Field label="Lieu de livraison" htmlFor="composer-dropoff">
              <PlaceSuggest
                id="composer-dropoff"
                required
                suppressLookup={dropoffFromPin}
                value={form.dropoffAddress}
                placeholder="Adresse d’arrivée"
                onFocus={() => setPinFocus("dropoff")}
                onChange={(dropoffAddress) => {
                  setDropoffFromPin(false);
                  setForm({ ...form, dropoffAddress });
                }}
                onSelect={(place) => pickDropoff(place)}
              />
            </Field>
            <p className="text-[11px] leading-4 text-[#5b6294]">
              Quand vous choisissez une adresse, la carte s’y rend et pose le pin. Vous pouvez ensuite le glisser, ou
              cliquer la carte (mode {pinFocus === "pickup" ? "Départ" : "Livraison"}).
            </p>
            <Field label="Heure prévue" htmlFor="composer-when">
              <Input
                id="composer-when"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </Field>
            <Field label="Chauffeur" htmlFor="composer-driver">
              <select
                id="composer-driver"
                value={form.assignedDeviceId}
                onChange={(e) => fillVehicleFromDriver(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
              >
                <option value="">Attribuer plus tard</option>
                {roster.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.callSign} — {driver.driverName}
                    {liveById.has(driver.id) ? " (en ligne)" : ""}
                  </option>
                ))}
              </select>
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
                Choisissez le chauffeur : son véhicule se remplit tout seul.{" "}
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
          Carte plein écran · placer départ et livraison
        </span>
      </span>
      <MapPinned className="size-5 shrink-0 text-[#7dd8f7]" />
    </button>
  );
}
