import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { Course, CourseDraft, CoursePatch, CourseStatus, VehicleType } from "./types";
import { COURSE_STATUSES } from "./types";
import { getDevice } from "./fleet-store";
import { getDriver, isVehicleType, normalizePlate } from "./driver-store";

const FILE = path.join(process.cwd(), ".data", "courses.json");
const courses = new Map<string, Course>();
let nextNumber = 1;

type StoredFile = {
  nextNumber?: number;
  courses?: Partial<Course>[];
};

function normalizeCourse(item: Partial<Course>): Course | null {
  if (!item?.id || !item.reference) return null;
  const status = isCourseStatus(item.status) ? item.status : "open";
  const vehicleType = isVehicleType(item.vehicleType) ? item.vehicleType : null;
  return {
    id: item.id,
    reference: item.reference,
    clientName: item.clientName ?? "",
    clientPhone: item.clientPhone ?? "",
    pickupAddress: item.pickupAddress ?? "",
    dropoffAddress: item.dropoffAddress ?? "",
    pickupLat: item.pickupLat ?? null,
    pickupLng: item.pickupLng ?? null,
    dropoffLat: item.dropoffLat ?? null,
    dropoffLng: item.dropoffLng ?? null,
    routePath: Array.isArray(item.routePath) ? item.routePath : [],
    distanceMeters: item.distanceMeters ?? null,
    durationSeconds: item.durationSeconds ?? null,
    bnNumber: item.bnNumber ?? null,
    hasDeliveryScan: Boolean(item.hasDeliveryScan),
    deliveryFileName: item.deliveryFileName ?? null,
    deliveryScannedAt: item.deliveryScannedAt ?? null,
    notes: item.notes ?? "",
    scheduledAt: item.scheduledAt ?? null,
    assignedDeviceId: item.assignedDeviceId ?? null,
    assignedCallSign: item.assignedCallSign ?? null,
    assignedDriverName: item.assignedDriverName ?? null,
    vehicleType,
    vehiclePlate: item.vehiclePlate ? normalizePlate(item.vehiclePlate) : null,
    vehicleLabel: item.vehicleLabel?.trim() || null,
    status,
    startedAt: item.startedAt ?? null,
    finishedAt: item.finishedAt ?? null,
    createdAt: item.createdAt ?? Date.now(),
    updatedAt: item.updatedAt ?? item.createdAt ?? Date.now(),
  };
}

function load() {
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as StoredFile | Partial<Course>[];
    const list = Array.isArray(parsed) ? parsed : (parsed.courses ?? []);
    const storedNext = Array.isArray(parsed) ? undefined : parsed.nextNumber;
    courses.clear();
    let max = 0;
    for (const item of list) {
      const course = normalizeCourse(item);
      if (!course) continue;
      courses.set(course.id, course);
      const n = Number.parseInt(course.reference.replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    nextNumber = Math.max(storedNext ?? 1, max + 1);
  } catch {
    /* first run */
  }
}

function save() {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(
    FILE,
    JSON.stringify({ nextNumber, courses: [...courses.values()] }, null, 2),
  );
}

load();

export function listCourses(): Course[] {
  return [...courses.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function listCoursesForDriver(driverId: string): Course[] {
  return listCourses().filter((course) => course.assignedDeviceId === driverId);
}

export function getCourse(id: string) {
  return courses.get(id) ?? null;
}

function emptyVehicle(course: Course): Course {
  return {
    ...course,
    vehicleType: null,
    vehiclePlate: null,
    vehicleLabel: null,
  };
}

function vehicleFromDriver(
  course: Course,
  deviceId: string,
  overlay?: {
    vehicleType?: VehicleType | null;
    vehiclePlate?: string | null;
    vehicleLabel?: string | null;
  },
): Course {
  const device = getDevice(deviceId);
  const account = getDriver(deviceId);
  const vehicleType =
    overlay?.vehicleType !== undefined
      ? overlay.vehicleType
      : (account?.vehicleType ?? device?.vehicleType ?? course.vehicleType);
  const vehiclePlate =
    overlay?.vehiclePlate !== undefined
      ? overlay.vehiclePlate
        ? normalizePlate(overlay.vehiclePlate)
        : null
      : (account?.vehiclePlate || device?.vehiclePlate || course.vehiclePlate);
  const vehicleLabel =
    overlay?.vehicleLabel !== undefined
      ? overlay.vehicleLabel?.trim() || null
      : (account?.vehicleLabel || device?.vehicleLabel || course.vehicleLabel);
  return {
    ...course,
    assignedDeviceId: deviceId,
    assignedCallSign: device?.callSign ?? account?.callSign ?? course.assignedCallSign,
    assignedDriverName: device?.driverName ?? account?.driverName ?? course.assignedDriverName,
    vehicleType,
    vehiclePlate,
    vehicleLabel,
  };
}

function applyAssignment(
  course: Course,
  deviceId: string | null,
  overlay?: {
    vehicleType?: VehicleType | null;
    vehiclePlate?: string | null;
    vehicleLabel?: string | null;
  },
): Course {
  if (!deviceId) {
    return emptyVehicle({
      ...course,
      assignedDeviceId: null,
      assignedCallSign: null,
      assignedDriverName: null,
      status: course.status === "done" || course.status === "cancelled" ? course.status : "open",
      updatedAt: Date.now(),
    });
  }
  const next = vehicleFromDriver(course, deviceId, overlay);
  return {
    ...next,
    status: course.status === "open" ? "assigned" : course.status,
    updatedAt: Date.now(),
  };
}

export function createCourse(draft: CourseDraft): Course {
  const id = crypto.randomUUID();
  const reference = `CCMM-${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  const now = Date.now();
  let course: Course = {
    id,
    reference,
    clientName: draft.clientName.trim(),
    clientPhone: (draft.clientPhone ?? "").trim(),
    pickupAddress: draft.pickupAddress.trim(),
    dropoffAddress: draft.dropoffAddress.trim(),
    pickupLat: draft.pickupLat ?? null,
    pickupLng: draft.pickupLng ?? null,
    dropoffLat: draft.dropoffLat ?? null,
    dropoffLng: draft.dropoffLng ?? null,
    routePath: draft.routePath ?? [],
    distanceMeters: draft.distanceMeters ?? null,
    durationSeconds: draft.durationSeconds ?? null,
    bnNumber: null,
    hasDeliveryScan: false,
    deliveryFileName: null,
    deliveryScannedAt: null,
    notes: (draft.notes ?? "").trim(),
    scheduledAt: draft.scheduledAt || null,
    assignedDeviceId: null,
    assignedCallSign: null,
    assignedDriverName: null,
    vehicleType: null,
    vehiclePlate: null,
    vehicleLabel: null,
    status: "open",
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  if (draft.assignedDeviceId) {
    course = applyAssignment(course, draft.assignedDeviceId, {
      vehicleType: draft.vehicleType,
      vehiclePlate: draft.vehiclePlate,
      vehicleLabel: draft.vehicleLabel,
    });
  }
  courses.set(course.id, course);
  save();
  return course;
}

export function updateCourse(id: string, patch: CoursePatch): Course | null {
  const existing = courses.get(id);
  if (!existing) return null;
  let next = { ...existing, updatedAt: Date.now() };
  if (patch.assignedDeviceId !== undefined) {
    next = applyAssignment(next, patch.assignedDeviceId, {
      vehicleType: patch.vehicleType,
      vehiclePlate: patch.vehiclePlate,
      vehicleLabel: patch.vehicleLabel,
    });
  } else {
    if (patch.vehicleType !== undefined) next.vehicleType = patch.vehicleType;
    if (patch.vehiclePlate !== undefined) {
      next.vehiclePlate = patch.vehiclePlate ? normalizePlate(patch.vehiclePlate) : null;
    }
    if (patch.vehicleLabel !== undefined) {
      next.vehicleLabel = patch.vehicleLabel?.trim() || null;
    }
  }
  if (patch.notes !== undefined) {
    next.notes = patch.notes.trim();
  }
  if (patch.bnNumber !== undefined) {
    next.bnNumber = patch.bnNumber.trim();
  }
  if (patch.status) {
    if (patch.status === "en_route" && !next.bnNumber) {
      return null;
    }
    if (patch.status === "done" && !next.hasDeliveryScan) {
      return null;
    }
    if (patch.status === "en_route") {
      next.startedAt = next.startedAt ?? Date.now();
    }
    if (patch.status === "done" || patch.status === "cancelled") {
      if (next.startedAt && !next.finishedAt) next.finishedAt = Date.now();
    }
    next.status = patch.status;
  }
  next.updatedAt = Date.now();
  courses.set(id, next);
  save();
  return next;
}

export function attachDeliveryScan(id: string, fileName: string): Course | null {
  const existing = courses.get(id);
  if (!existing) return null;
  const next: Course = {
    ...existing,
    hasDeliveryScan: true,
    deliveryFileName: fileName,
    deliveryScannedAt: Date.now(),
    updatedAt: Date.now(),
  };
  courses.set(id, next);
  save();
  return next;
}

export function isCourseStatus(value: unknown): value is CourseStatus {
  return typeof value === "string" && (COURSE_STATUSES as readonly string[]).includes(value);
}
