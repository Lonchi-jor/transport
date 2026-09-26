"use client";

export default function DispatchNote({
  notes,
  tone = "light",
}: {
  notes?: string | null;
  tone?: "light" | "dark";
}) {
  const text = notes?.trim();
  if (!text) return null;
  const dark = tone === "dark";
  return (
    <div
      className={
        dark
          ? "rounded-xl border border-[#00a4e8]/45 bg-[#00a4e8]/15 px-3 py-2"
          : "rounded-xl border border-[#00a4e8]/35 bg-[#e7f6fd] px-3 py-2"
      }
    >
      <div
        className={
          dark
            ? "text-[10px] font-semibold uppercase tracking-wide text-[#7dd8f7]"
            : "text-[10px] font-semibold uppercase tracking-wide text-[#00a4e8]"
        }
      >
        Note du dispatch — lisez-la
      </div>
      <p
        className={
          dark
            ? "mt-1 whitespace-pre-wrap text-sm leading-5 text-white"
            : "mt-1 whitespace-pre-wrap text-sm leading-5 text-[#1c2268]"
        }
      >
        {text}
      </p>
    </div>
  );
}
