"use client";

import { useMemo, type MouseEvent, type ReactNode } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { telHref } from "@/lib/format";
import { isDriverAtCapacity, liveJobsForDriver } from "@/lib/assignment";
import type { Course } from "@/lib/types";
import { MAX_TRAILERS, VEHICLE_META, VEHICLE_TYPES, type VehicleType } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";

const LATER_ID = "__later__";

type DriverOption = {
  id: string;
  callSign: string;
  driverName: string;
  phone: string;
  vehiclePlate: string;
  trailerPlates: string;
  label: string;
  suffix: string;
  full: boolean;
  load: number;
};

type DriverGroup = {
  value: string;
  label: string;
  items: DriverOption[];
};

function optionLabel(driver: RosterDriver) {
  return `${driver.callSign} — ${driver.driverName}`;
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function DriverAssignSelect({
  id,
  value,
  roster,
  courses,
  exceptCourseId,
  liveById,
  emptyLabel,
  onChange,
}: {
  id: string;
  value: string;
  roster: RosterDriver[];
  courses: Course[];
  exceptCourseId?: string | null;
  liveById?: Map<string, unknown>;
  emptyLabel: string;
  onChange: (id: string) => void;
}) {
  const later: DriverOption = useMemo(
    () => ({
      id: LATER_ID,
      callSign: "",
      driverName: "",
      phone: "",
      vehiclePlate: "",
      trailerPlates: "",
      label: emptyLabel,
      suffix: "",
      full: false,
      load: -1,
    }),
    [emptyLabel],
  );

  const groups = useMemo((): DriverGroup[] => {
    const free: DriverOption[] = [];
    const one: DriverOption[] = [];
    const full: DriverOption[] = [];

    const ranked = [...roster].sort((a, b) => {
      const aOn = liveById?.has(a.id) ? 0 : 1;
      const bOn = liveById?.has(b.id) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return a.callSign.localeCompare(b.callSign, "fr");
    });

    for (const driver of ranked) {
      const live = liveJobsForDriver(courses, driver.id, exceptCourseId);
      const atCapacity = isDriverAtCapacity(courses, driver.id, exceptCourseId);
      const option: DriverOption = {
        id: driver.id,
        callSign: driver.callSign,
        driverName: driver.driverName,
        phone: driver.phone ?? "",
        vehiclePlate: driver.vehiclePlate ?? "",
        trailerPlates: (driver.trailerPlates ?? []).join(" "),
        label: optionLabel(driver),
        suffix: atCapacity
          ? `complet · ${live.map((job) => job.reference).join(" · ")}`
          : live.length === 1
            ? `1 course · ${live[0].reference}`
            : liveById?.has(driver.id)
              ? "en ligne"
              : "",
        full: atCapacity,
        load: live.length,
      };
      if (option.load === 0) free.push(option);
      else if (option.full) full.push(option);
      else one.push(option);
    }

    return [
      { value: "later", label: "", items: [later] },
      { value: "free", label: "Sans course en cours", items: free },
      { value: "one", label: "Une course", items: one },
      { value: "full", label: "Complet", items: full },
    ].filter((group) => group.items.length > 0);
  }, [roster, courses, exceptCourseId, liveById, later]);

  const selected =
    groups.flatMap((group) => group.items).find((item) => item.id === (value || LATER_ID)) ?? later;

  return (
    <Combobox.Root
      items={groups}
      value={selected}
      onValueChange={(item) => {
        if (!item || item.id === LATER_ID) onChange("");
        else onChange(item.id);
      }}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
      autoHighlight
      filter={(item, query) => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        if (item.id === LATER_ID) return false;
        return [item.callSign, item.driverName, item.phone, item.vehiclePlate, item.trailerPlates, item.label]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }}
    >
      <Combobox.InputGroup className="relative flex h-9 w-full items-center rounded-lg border border-input bg-white focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Combobox.Input
          id={id}
          placeholder="Rechercher un indicatif, un nom…"
          autoComplete="off"
          className="h-full w-full min-w-0 rounded-lg bg-transparent px-2.5 pr-8 text-sm outline-none"
        />
        <Combobox.Trigger
          className="absolute right-0.5 flex size-8 items-center justify-center text-[#5b6294]"
          aria-label="Ouvrir la liste des chauffeurs"
        >
          <ChevronDown className="size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-[120]" sideOffset={4} align="start">
          <Combobox.Popup className="max-h-64 w-(--anchor-width) min-w-56 overflow-y-auto rounded-lg bg-white text-[#1c2268] shadow-lg ring-1 ring-foreground/10">
            <Combobox.Empty className="px-3 py-2.5 text-sm text-[#5b6294]">
              Aucun chauffeur pour cette recherche.
            </Combobox.Empty>
            <Combobox.List>
              {(group: DriverGroup) => (
                <Combobox.Group key={group.value} items={group.items} className="py-1">
                  {group.label ? (
                    <Combobox.GroupLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#5b6294]">
                      {group.label}
                    </Combobox.GroupLabel>
                  ) : null}
                  <Combobox.Collection>
                    {(item: DriverOption) => (
                      <Combobox.Item
                        key={item.id}
                        value={item}
                        disabled={item.full}
                        className="flex cursor-default flex-col gap-0.5 px-2.5 py-1.5 text-sm outline-none data-highlighted:bg-[#e7f6fd] data-disabled:cursor-not-allowed data-disabled:opacity-50"
                      >
                        <span className="font-medium">{item.label}</span>
                        {item.suffix ? (
                          <span className="text-[11px] text-[#5b6294]">{item.suffix}</span>
                        ) : null}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export function TrailerFields({
  idPrefix,
  vehicleType,
  plates,
  onTypeChange,
  onChange,
}: {
  idPrefix: string;
  vehicleType: VehicleType;
  plates: string[];
  onTypeChange: (type: VehicleType) => void;
  onChange: (plates: string[]) => void;
}) {
  const list = plates.length > 0 ? plates : [""];

  function patchAt(index: number, value: string) {
    const next = [...list];
    next[index] = value;
    onChange(next);
  }

  function removeAt(index: number) {
    if (list.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(list.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="grid gap-3 rounded-xl border border-[#e4e9f6] bg-[#f8faff] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6294]">Remorque</div>
      <Field label="Type" htmlFor={`${idPrefix}-trailer-type`}>
        <select
          id={`${idPrefix}-trailer-type`}
          value={vehicleType}
          onChange={(event) => onTypeChange(event.target.value as VehicleType)}
          className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none"
        >
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {VEHICLE_META[type].label}
            </option>
          ))}
        </select>
      </Field>
      {list.map((plate, index) => (
        <div key={`${idPrefix}-trailer-${index}`} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Field
              label={list.length > 1 ? `Immatriculation ${index + 1}` : "Immatriculation"}
              htmlFor={`${idPrefix}-trailer-${index}`}
            >
              <Input
                id={`${idPrefix}-trailer-${index}`}
                value={plate}
                onChange={(event) => patchAt(index, event.target.value.toUpperCase())}
                placeholder="CE 5678 XX"
                autoCapitalize="characters"
              />
            </Field>
          </div>
          {list.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mt-6 size-8 shrink-0 text-[#5b6294]"
              onClick={() => removeAt(index)}
              aria-label={`Retirer la remorque ${index + 1}`}
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
        disabled={list.length >= MAX_TRAILERS}
        onClick={() => onChange([...list, ""])}
      >
        <Plus className="size-4" />
        Ajouter une remorque
      </Button>
    </div>
  );
}

export function VehicleFields({
  idPrefix,
  vehicleType,
  vehiclePlate,
  plateRequired,
  onChange,
}: {
  idPrefix: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  plateRequired?: boolean;
  onChange: (patch: { vehicleType?: VehicleType; vehiclePlate?: string }) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-[#e4e9f6] bg-[#f8faff] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5b6294]">Véhicule</div>
      <Field label="Type" htmlFor={`${idPrefix}-vehicleType`}>
        <select
          id={`${idPrefix}-vehicleType`}
          value={vehicleType}
          onChange={(e) => onChange({ vehicleType: e.target.value as VehicleType })}
          className="h-9 w-full rounded-lg border border-input bg-white px-2.5 text-sm outline-none"
        >
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {VEHICLE_META[type].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Immatriculation" htmlFor={`${idPrefix}-plate`}>
        <Input
          id={`${idPrefix}-plate`}
          required={plateRequired}
          value={vehiclePlate}
          onChange={(e) => onChange({ vehiclePlate: e.target.value.toUpperCase() })}
          placeholder="LT 1234 CE"
          autoCapitalize="characters"
        />
      </Field>
    </div>
  );
}

export function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#d5dcf0] bg-white p-3 shadow-sm">
      <div className="text-[#00a4e8]">{icon}</div>
      <div className="mt-1 text-xl font-semibold text-[#2b308f]">{value}</div>
      <div className="text-[11px] text-[#5b6294]">{label}</div>
    </div>
  );
}

export function PhoneLink({
  phone,
  className,
  onClick,
}: {
  phone?: string | null;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  if (!phone?.trim()) return null;
  return (
    <a href={telHref(phone)} className={className ?? "text-[#00a4e8] hover:underline"} onClick={onClick}>
      {phone}
    </a>
  );
}
