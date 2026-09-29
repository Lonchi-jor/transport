import { Badge } from "@/components/ui/badge";
import { COURSE_STATUS_LABEL, courseStatusBadgeClass } from "@/lib/format";
import type { CourseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function CourseStatusBadge({
  status,
  className,
}: {
  status: CourseStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 px-2.5 font-semibold", courseStatusBadgeClass(status), className)}
    >
      {COURSE_STATUS_LABEL[status]}
    </Badge>
  );
}
