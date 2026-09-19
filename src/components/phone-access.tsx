"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  compact?: boolean;
};

function subscribe() {
  return () => {};
}

export default function PhoneAccess({ compact = false }: Props) {
  const pageUrl = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/phone-url", { cache: "no-store" });
        const data = (await res.json()) as { url: string | null };
        setTunnelUrl(data.url);
      } catch {
        setTunnelUrl(null);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, []);

  const shareUrl = tunnelUrl || pageUrl;
  const isLocal =
    shareUrl.includes("127.0.0.1") ||
    shareUrl.includes("localhost") ||
    /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(shareUrl);

  const hint = useMemo(() => {
    if (tunnelUrl) {
      return "HTTPS link for your phone. GPS works here. Keep this page open while you test.";
    }
    if (isLocal) {
      return "This address only works on this computer. Run npm run phone in another terminal, then scan the QR that appears.";
    }
    return "Open this link on your phone, then Add to Home Screen.";
  }, [isLocal, tunnelUrl]);

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!shareUrl) return null;

  return (
    <div
      className={
        compact
          ? "rounded-2xl border border-white/10 bg-black/30 p-3"
          : "rounded-3xl border border-white/10 bg-black/25 p-4"
      }
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
        <Smartphone className="size-4" />
        Test on your phone
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-white p-2">
          <QRCodeSVG value={shareUrl} size={compact ? 96 : 132} marginSize={0} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-5 text-zinc-300">{hint}</p>
          <p className="mt-2 truncate font-mono text-[11px] text-emerald-200">{shareUrl}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2 h-8 rounded-lg bg-white/10 text-zinc-100"
            onClick={() => void copy()}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
      <ol className="mt-3 list-decimal space-y-1 pl-4 text-[11px] leading-5 text-zinc-400">
        <li>Open the link in Safari or Chrome on the phone.</li>
        <li>Allow location when you join as a driver.</li>
        <li>
          iPhone: Share → Add to Home Screen. Android: menu → Install app.
        </li>
      </ol>
    </div>
  );
}
