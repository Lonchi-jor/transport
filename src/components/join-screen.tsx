"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Monitor } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PhoneAccess from "@/components/phone-access";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { VehicleType } from "@/lib/types";
import { loadCredentials, saveCredentials, shouldAutoLogin } from "@/lib/driver-session";

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

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function JoinScreen({ onJoin }: Props) {
  const [callSign, setCallSign] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const onJoinRef = useRef(onJoin);
  onJoinRef.current = onJoin;

  async function login(sign: string, code: string) {
    const nextSign = sign.trim();
    const nextPin = code.replace(/\D/g, "");
    if (!nextSign) {
      setError("Entrez l’indicatif donné par le bureau (ex. ME-01).");
      return;
    }
    if (nextPin.length < 4) {
      setError("Entrez le code PIN donné par le bureau.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drivers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSign: nextSign, pin: nextPin }),
      });
      const data = (await res.json()) as {
        driver?: JoinPayload;
        error?: string;
      };
      if (!res.ok || !data.driver) {
        setError(data.error || "Connexion impossible.");
        return;
      }
      saveCredentials(nextSign, nextPin);
      onJoinRef.current({
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

  useEffect(() => {
    const creds = loadCredentials();
    if (creds) {
      setCallSign(creds.callSign);
      setPin(creds.pin);
    }
    if (creds && shouldAutoLogin()) {
      void login(creds.callSign, creds.pin);
    }
    // Reconnect once from the PIN saved on this phone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(callSign, pin);
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
            Une fois connecté, ce téléphone garde l’indicatif et le PIN. À la prochaine ouverture, la connexion se fait toute seule.
          </p>
          <Link
            href="/admin"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#00a4e8]"
          >
            <Monitor className="size-4" />
            Tableau de bord dispatch (ordinateur)
          </Link>
        </div>

        <form
          method="post"
          action="/api/drivers/login"
          autoComplete="on"
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-5 rounded-3xl border border-[#d5dcf0] bg-white p-5 shadow-[0_12px_40px_rgba(43,48,143,0.08)]"
        >
          <div className="grid gap-2">
            <Label htmlFor="callSign">Indicatif</Label>
            <input
              id="callSign"
              name="username"
              value={callSign}
              onChange={(event) => {
                setCallSign(event.target.value);
                setError("");
              }}
              placeholder="ME-01"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              className={fieldClass}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pin">Code PIN</Label>
            <input
              id="pin"
              name="password"
              type="password"
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              placeholder="••••"
              inputMode="numeric"
              maxLength={6}
              autoComplete="current-password"
              className={`${fieldClass} font-mono tracking-widest`}
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
