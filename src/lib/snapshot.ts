import { isDemoRunning, listDevices } from "@/lib/fleet-store";
import { listCourses } from "@/lib/course-store";
import type { Course, FleetDevice } from "@/lib/types";

export type RadioSnapshot = {
  devices: FleetDevice[];
  courses: Course[];
  now: number;
  demo: boolean;
};

export function radioSnapshot(): RadioSnapshot {
  return {
    devices: listDevices(),
    courses: listCourses(),
    now: Date.now(),
    demo: isDemoRunning(),
  };
}
