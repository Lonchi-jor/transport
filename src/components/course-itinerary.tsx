import { courseStops, destinationLine, destinationMark, destinationTitle } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Course } from "@/lib/types";

export function CourseItinerary({
  course,
  compact = false,
  tone = "light",
}: {
  course: Course;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const stops = courseStops(course);
  if (compact) {
    const dests = stops.map((stop, index) => destinationLine(stop.address, index, stops.length)).filter(Boolean);
    return <span>{[course.pickupAddress, ...dests].filter(Boolean).join(" → ")}</span>;
  }
  const dark = tone === "dark";
  return (
    <ol className="space-y-2">
      <li className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00a4e8] px-1.5 text-[10px] font-bold text-white">
          D
        </span>
        <div className="min-w-0">
          <div className={cn("text-[11px] font-medium uppercase tracking-wide", dark ? "text-[#7dd8f7]" : "text-[#5b6294]")}>
            Départ
          </div>
          <div className={cn("text-sm leading-snug", dark ? "text-white" : "text-[#1c2268]")}>
            {course.pickupAddress}
          </div>
        </div>
      </li>
      {stops.map((stop, index) => {
        const mark = destinationMark(index, stops.length);
        return (
          <li key={stop.id || `${stop.address}-${index}`} className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2b308f] text-[11px] font-bold text-white">
              {mark}
            </span>
            <div className="min-w-0">
              <div className={cn("text-[11px] font-medium uppercase tracking-wide", dark ? "text-[#7dd8f7]" : "text-[#00a4e8]")}>
                {destinationTitle(index, stops.length)}
              </div>
              <div className={cn("text-sm leading-snug", dark ? "text-white" : "text-[#1c2268]")}>{stop.address}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
