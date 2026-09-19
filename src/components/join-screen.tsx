"use client";

import { useState } from "react";
import Link from "next/link";
import { BusFront, MapPinned, Monitor } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PhoneAccess from "@/components/phone-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VEHICLE_META, VEHICLE_TYPES, type Role, type VehicleType } from "@/lib/types";

export type JoinPayload = {
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  role: Role;
};

type Props = {
  onJoin: (payload: JoinPayload) => void;
};

export default function JoinScreen({ onJoin }: Props) {
  const [callSign, setCallSign] = useState("ME-01");
  const [driverName, setDriverName] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("bus");
  const [role, setRole] = useState<Role>("driver");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!callSign.trim()) {
      setError("Enter a vehicle call sign so the desk can identify you.");
      return;
    }
    if (!driverName.trim()) {
      setError("Enter the driver or dispatcher name.");
      return;
    }
    onJoin({
      callSign: callSign.trim().toUpperCase(),
      driverName: driverName.trim(),
      vehicleType,
      role,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(900px_420px_at_0%_-10%,#d7f0fc_0%,transparent_55%),linear-gradient(180deg,#ffffff_0%,#eef3fb_100%)] px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-[#1c2268]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 mt-2">
          <div className="rounded-3xl bg-white px-4 py-5 shadow-[0_12px_40px_rgba(43,48,143,0.08)]">
            <BrandLogo />
          </div>
          <p className="mt-4 text-sm font-medium tracking-wide text-[#00a4e8]">
            Suivi de flotte · Fleet tracking
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#2b308f]">
            Vehicles on the road
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#5b6294]">
            Téléphone chauffeur : rejoignez la carte. Bureau : donnez les
            courses depuis le tableau de bord.
          </p>
          <Link
            href="/admin"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#00a4e8]"
          >
            <Monitor className="size-4" />
            Tableau de bord dispatch (ordinateur)
          </Link>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5 rounded-3xl border border-[#d5dcf0] bg-white p-5 shadow-[0_12px_40px_rgba(43,48,143,0.08)]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                role === "driver"
                  ? "border-[#00a4e8] bg-[#00a4e8] text-white"
                  : "border-[#d5dcf0] bg-[#f4f7fc] text-[#2b308f]"
              }`}
            >
              <MapPinned className="mb-1 size-4" />
              <div className="font-semibold">Driver</div>
              <div className="text-xs opacity-80">Share this phone GPS</div>
            </button>
            <button
              type="button"
              onClick={() => setRole("dispatcher")}
              className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                role === "dispatcher"
                  ? "border-[#2b308f] bg-[#2b308f] text-white"
                  : "border-[#d5dcf0] bg-[#f4f7fc] text-[#2b308f]"
              }`}
            >
              <BusFront className="mb-1 size-4" />
              <div className="font-semibold">Dispatch</div>
              <div className="text-xs opacity-80">Watch the whole fleet</div>
            </button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="callSign">Call sign</Label>
            <Input
              id="callSign"
              value={callSign}
              onChange={(e) => setCallSign(e.target.value)}
              placeholder="CAM-12"
              className="h-11 rounded-xl text-base"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="driverName">
              {role === "dispatcher" ? "Desk name" : "Driver name"}
            </Label>
            <Input
              id="driverName"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder={role === "dispatcher" ? "CCMM desk" : "Your name"}
              className="h-11 rounded-xl text-base"
            />
          </div>

          <div className="grid gap-2">
            <Label>Vehicle type</Label>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium capitalize ${
                    vehicleType === type
                      ? "border-[#2b308f] bg-[#2b308f] text-white"
                      : "border-[#d5dcf0] bg-[#f4f7fc] text-[#2b308f]"
                  }`}
                >
                  <span
                    className="mr-1 inline-block size-2 rounded-full"
                    style={{ background: VEHICLE_META[type].color }}
                  />
                  {type}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" size="lg" className="h-12 rounded-xl text-base">
            Join the map
          </Button>
        </form>

        <div className="mt-4">
          <PhoneAccess />
        </div>

        <p className="mt-auto pt-6 text-center text-xs leading-5 text-[#5b6294]">
          CCMM — Construction Carrosserie Menuiserie Métallique. Open this app
          on every works vehicle so the desk can see it live.
        </p>
      </div>
    </div>
  );
}
