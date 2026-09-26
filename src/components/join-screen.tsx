"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PhoneAccess from "@/components/phone-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VehicleType } from "@/lib/types";

export type JoinPayload = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  role: "driver";
};

type Props = {
  onJoin: (payload: JoinPayload) => void;
};

export default function JoinScreen({ onJoin }: Props) {
  const [callSign, setCallSign] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const code = pin.replace(/\D/g, "");
    if (!callSign.trim()) {
      setError("Entrez l’indicatif donné par le bureau (ex. ME-01).");
      return;
    }
    if (code.length < 4) {
      setError("Entrez le code PIN donné par le bureau.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drivers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSign: callSign.trim(), pin: code }),
      });
      const data = (await res.json()) as {
        driver?: JoinPayload;
        error?: string;
      };
      if (!res.ok || !data.driver) {
        setError(data.error || "Connexion impossible.");
        return;
      }
      onJoin({
        id: data.driver.id,
        callSign: data.driver.callSign,
        driverName: data.driver.driverName,
        vehicleType: data.driver.vehicleType,
        vehiclePlate: data.driver.vehiclePlate ?? "",
        role: "driver",
      });
    } catch {
      setError("Réseau indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(900px_420px_at_0%_-10%,#d7f0fc_0%,transparent_55%),linear-gradient(180deg,#ffffff_0%,#eef3fb_100%)] px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))] text-[#1c2268]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 mt-2">
          <div className="rounded-3xl bg-white px-4 py-5 shadow-[0_12px_40px_rgba(43,48,143,0.08)]">
            <BrandLogo />
          </div>
          <p className="mt-4 text-sm font-medium tracking-wide text-[#00a4e8]">
            Connexion chauffeur
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#2b308f]">
            Entrez vos identifiants CCMM
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[#5b6294]">
            Le bureau crée votre fiche. Sur le téléphone, connectez-vous seulement avec l’indicatif et le code PIN.
          </p>
          <Link
            href="/admin"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#00a4e8]"
          >
            <Monitor className="size-4" />
            Tableau de bord dispatch (ordinateur)
          </Link>
        </div>

        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5 rounded-3xl border border-[#d5dcf0] bg-white p-5 shadow-[0_12px_40px_rgba(43,48,143,0.08)]">
          <div className="grid gap-2">
            <Label htmlFor="callSign">Indicatif</Label>
            <Input
              id="callSign"
              value={callSign}
              onChange={(e) => setCallSign(e.target.value)}
              placeholder="ME-01"
              autoCapitalize="characters"
              className="h-11 rounded-xl text-base"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pin">Code PIN</Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              className="h-11 rounded-xl font-mono text-base tracking-widest"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" size="lg" className="h-12 rounded-xl text-base" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        <div className="mt-4">
          <PhoneAccess />
        </div>

        <p className="mt-auto pt-6 text-center text-xs leading-5 text-[#5b6294]">
          Pas encore de compte ? Demandez au dispatch de vous créer dans le tableau de bord admin.
        </p>
      </div>
    </div>
  );
}
