"use client";

import { useState } from "react";
import { BusFront, MapPinned, Radio } from "lucide-react";
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
  const [callSign, setCallSign] = useState("BUS-12");
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
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(1200px_600px_at_10%_-10%,#1d4a3a_0%,transparent_55%),linear-gradient(180deg,#07110d_0%,#0c1813_100%)] px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-zinc-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 mt-4">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-200">
            <Radio className="size-3.5" />
            Live fleet radio
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">TransitLive</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-300">
            Sign your vehicle onto the board. Every connected device shares its
            position so dispatch can see buses, taxis, trucks, and shuttles on
            one map.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("driver")}
              className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                role === "driver"
                  ? "border-amber-300 bg-amber-300 text-zinc-950"
                  : "border-white/10 bg-white/5 text-zinc-200"
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
                  ? "border-amber-300 bg-amber-300 text-zinc-950"
                  : "border-white/10 bg-white/5 text-zinc-200"
              }`}
            >
              <BusFront className="mb-1 size-4" />
              <div className="font-semibold">Dispatch</div>
              <div className="text-xs opacity-80">Watch the whole fleet</div>
            </button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="callSign" className="text-zinc-200">
              Call sign
            </Label>
            <Input
              id="callSign"
              value={callSign}
              onChange={(e) => setCallSign(e.target.value)}
              placeholder="BUS-12"
              className="h-11 rounded-xl border-white/10 bg-white/10 text-base text-white placeholder:text-zinc-400"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="driverName" className="text-zinc-200">
              {role === "dispatcher" ? "Desk name" : "Driver name"}
            </Label>
            <Input
              id="driverName"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder={role === "dispatcher" ? "Central desk" : "Your name"}
              className="h-11 rounded-xl border-white/10 bg-white/10 text-base text-white placeholder:text-zinc-400"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-zinc-200">Vehicle type</Label>
            <div className="grid grid-cols-3 gap-2">
              {VEHICLE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setVehicleType(type)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium capitalize ${
                    vehicleType === type
                      ? "border-white bg-white text-zinc-950"
                      : "border-white/10 bg-white/5 text-zinc-200"
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

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <Button type="submit" size="lg" className="h-12 rounded-xl bg-amber-300 text-zinc-950 hover:bg-amber-200">
            Join the map
          </Button>
        </form>

        <div className="mt-4">
          <PhoneAccess />
        </div>

        <p className="mt-auto pt-6 text-center text-xs leading-5 text-zinc-400">
          Open this app on every vehicle phone. Positions update live while the
          device stays connected.
        </p>
      </div>
    </div>
  );
}
