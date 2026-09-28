import { PRESENCE_BADGE_CLASS, presenceKind, presenceLabel, type PresenceKind } from "@/lib/presence";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PresenceDot({ kind, className }: { kind: PresenceKind; className?: string }) {
  const color =
    kind === "online" ? "bg-green-600" : kind === "recent" ? "bg-amber-500" : kind === "stale" ? "bg-red-600" : "bg-slate-400";
  return <span className={cn("size-2.5 shrink-0 rounded-full", color, className)} />;
}

export function PresenceBadge({
  connected,
  lastSeen,
  now,
  className,
}: {
  connected?: boolean | null;
  lastSeen?: number | null;
  now: number;
  className?: string;
}) {
  const kind = presenceKind({ connected, lastSeen }, now);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        PRESENCE_BADGE_CLASS[kind],
        className,
      )}
      title={formatWhen(lastSeen) ?? undefined}
    >
      <PresenceDot kind={kind} />
      <span className="truncate">{presenceLabel(kind, lastSeen, now)}</span>
    </span>
  );
}

export function PresenceLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#5b6294]", className)}>
      <li className="inline-flex items-center gap-1.5">
        <PresenceDot kind="online" />
        En ligne
      </li>
      <li className="inline-flex items-center gap-1.5">
        <PresenceDot kind="recent" />
        Vu il y a moins de 30 min
      </li>
      <li className="inline-flex items-center gap-1.5">
        <PresenceDot kind="stale" />
        Déconnecté depuis plus de 30 min
      </li>
    </ul>
  );
}
