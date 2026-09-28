import { courseStops, tourLine } from "@/lib/format";
import type { Course } from "@/lib/types";

export function CourseItinerary({
  course,
  compact = false,
}: {
  course: Course;
  compact?: boolean;
}) {
  if (compact) {
    return <span>{tourLine(course)}</span>;
  }
  const stops = courseStops(course);
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#5b6294]">Voyage</div>
        <div className="text-sm leading-snug">{course.pickupAddress}</div>
      </div>
      {stops.map((stop, index) => (
        <div key={stop.id || `${stop.address}-${index}`}>
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#00a4e8]">
            Destination {index + 1}
          </div>
          <div className="text-sm leading-snug">{stop.address}</div>
        </div>
      ))}
    </div>
  );
}
