import { isDemoRunning, listDevices } from "@/lib/fleet-store";
import { listCourses } from "@/lib/course-store";
import { listDrivers, listDriversPublic } from "@/lib/driver-store";
import { listNotifications } from "@/lib/notification-store";
import type { AppNotification, Course, FleetDevice } from "@/lib/types";
import type { DriverAccount, DriverPublic } from "@/lib/driver-store";

export type RadioSnapshot = {
  devices: FleetDevice[];
  courses: Course[];
  notifications: AppNotification[];
  drivers: DriverPublic[];
  now: number;
  demo: boolean;
};

export function radioSnapshot(): RadioSnapshot {
  return {
    devices: listDevices(),
    courses: listCourses(),
    notifications: listNotifications(),
    drivers: listDriversPublic(),
    now: Date.now(),
    demo: isDemoRunning(),
  };
}

export function adminSnapshot(): RadioSnapshot & { drivers: DriverAccount[] } {
  return {
    ...radioSnapshot(),
    drivers: listDrivers(),
  };
}
