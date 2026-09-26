import { getDevice, isDemoRunning, listDevices } from "@/lib/fleet-store";
import { listCourses, listCoursesForDriver } from "@/lib/course-store";
import { getDriverPublic, listDrivers, listDriversPublic } from "@/lib/driver-store";
import { listNotifications, listNotificationsFor } from "@/lib/notification-store";
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

/** Phone radio: this chauffeur's vehicle, jobs, and alerts only — never other GPS. */
export function driverSnapshot(driverId: string): RadioSnapshot {
  const id = driverId.trim();
  const me = id ? getDevice(id) : null;
  const account = id ? getDriverPublic(id) : null;
  return {
    devices: me && me.role === "driver" ? [me] : [],
    courses: id ? listCoursesForDriver(id) : [],
    notifications: id ? listNotificationsFor(id) : [],
    drivers: account ? [account] : [],
    now: Date.now(),
    demo: false,
  };
}

export function snapshotForDriverId(driverId: string | null | undefined): RadioSnapshot {
  const id = driverId?.trim() ?? "";
  if (!id) return radioSnapshot();
  return driverSnapshot(id);
}

export function snapshotFromRequest(request: Request): RadioSnapshot {
  return snapshotForDriverId(new URL(request.url).searchParams.get("driver"));
}
