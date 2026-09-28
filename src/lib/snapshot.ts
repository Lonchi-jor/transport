import { getDevice, isDemoRunning, listDevices } from "@/lib/fleet-store";
import { listCourses, listCoursesForDriver } from "@/lib/course-store";
import { getDriverPublic, listDrivers, listDriversPublic } from "@/lib/driver-store";
import { listNotifications, listNotificationsFor } from "@/lib/notification-store";
import { getPresence } from "@/lib/presence-store";
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

function withPresence<T extends { id: string }>(driver: T): T & {
  lastLat: number | null;
  lastLng: number | null;
  lastFixAt: number | null;
  lastSeenAt: number | null;
} {
  const presence = getPresence(driver.id);
  return {
    ...driver,
    lastLat: presence?.lastLat ?? null,
    lastLng: presence?.lastLng ?? null,
    lastFixAt: presence?.lastFixAt ?? null,
    lastSeenAt: presence?.lastSeenAt ?? null,
  };
}

function ghostDevice(
  driver: { id: string; callSign: string; driverName: string; phone?: string | null; vehicleType: FleetDevice["vehicleType"]; vehiclePlate?: string | null },
  presence: NonNullable<ReturnType<typeof getPresence>>,
): FleetDevice {
  return {
    id: driver.id,
    callSign: driver.callSign,
    driverName: driver.driverName,
    phone: driver.phone ?? null,
    vehicleType: driver.vehicleType,
    vehiclePlate: driver.vehiclePlate ?? null,
    role: "driver",
    lat: presence.lastLat,
    lng: presence.lastLng,
    heading: presence.lastHeading,
    speedMps: null,
    accuracy: presence.lastAccuracy,
    sharing: presence.lastLat != null && presence.lastLng != null,
    simulated: false,
    lastSeen: presence.lastSeenAt,
    connected: false,
  };
}

/** Live radio plus last-known GPS so a disconnected chauffeur still appears on the desk map. */
export function adminFleetDevices(): FleetDevice[] {
  const live: FleetDevice[] = listDevices().map((device) => ({
    ...device,
    connected: device.role === "driver",
  }));
  const byId = new Map<string, FleetDevice>(live.map((device) => [device.id, device]));
  for (const driver of listDrivers()) {
    const presence = getPresence(driver.id);
    const current = byId.get(driver.id);
    if (current && current.role === "driver") {
      if ((current.lat == null || current.lng == null) && presence?.lastLat != null && presence.lastLng != null) {
        current.lat = presence.lastLat;
        current.lng = presence.lastLng;
        current.heading = current.heading ?? presence.lastHeading;
        current.accuracy = current.accuracy ?? presence.lastAccuracy;
        current.sharing = true;
      }
      continue;
    }
    if (presence?.lastLat == null || presence.lastLng == null) continue;
    byId.set(driver.id, ghostDevice(driver, presence));
  }
  return [...byId.values()].sort((a, b) => a.callSign.localeCompare(b.callSign));
}

export function radioSnapshot(): RadioSnapshot {
  return {
    devices: adminFleetDevices(),
    courses: listCourses(),
    notifications: listNotifications(),
    drivers: listDriversPublic().map(withPresence),
    now: Date.now(),
    demo: isDemoRunning(),
  };
}

export function adminSnapshot(): RadioSnapshot & { drivers: DriverAccount[] } {
  return {
    ...radioSnapshot(),
    drivers: listDrivers().map((driver) => withPresence(driver)),
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
