import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { Course, CourseDraft, CoursePatch, CourseStatus, CourseStop, VehicleType } from "./types";
import { COURSE_STATUSES, MAX_TOUR_STOPS } from "./types";
import { getDevice } from "./fleet-store";
import { getDriver, isVehicleType, normalizePlate, normalizeTrailerPlates } from "./driver-store";
import { addNotification } from "./notification-store";
import { tourLine } from "./format";
import {
  assignmentBlockedMessage,
  CourseAssignError,
  CourseStartError,
  inProgressJobForDriver,
  isDriverAtCapacity,
  liveJobsForDriver,
} from "./assignment";

const FILE = path.join(process.cwd(), ".data", "courses.json");
const courses = new Map<string, Course>();
let nextNumber = 1;

type StoredFile = {
  nextNumber?: number;
  courses?: Partial<Course>[];
};

function normalizeStops(
  item: Pick<Partial<Course>, "stops" | "dropoffAddress" | "dropoffLat" | "dropoffLng">,
): CourseStop[] {
  const raw = Array.isArray(item.stops) ? item.stops : [];
  const fromDraft = raw
    .map((stop) => ({
      id: stop?.id?.trim() || crypto.randomUUID(),
      address: (stop?.address ?? "").trim(),
      lat: stop?.lat ?? null,
      lng: stop?.lng ?? null,
    }))
    .filter((stop) => stop.address || (stop.lat != null && stop.lng != null))
    .slice(0, MAX_TOUR_STOPS);
  if (fromDraft.length) return fromDraft;
  if (item.dropoffAddress?.trim()) {
    return [
      {
        id: "dropoff",
        address: item.dropoffAddress.trim(),
        lat: item.dropoffLat ?? null,
        lng: item.dropoffLng ?? null,
      },
    ];
  }
  return [];
}

function lastStop(stops: CourseStop[]) {
  return stops[stops.length - 1] ?? null;
}

function normalizeCourse(item: Partial<Course>): Course | null {
  if (!item?.id || !item.reference) return null;
  const status = isCourseStatus(item.status) ? item.status : "open";
  const vehicleType = isVehicleType(item.vehicleType) ? item.vehicleType : null;
  const stops = normalizeStops(item);
  const finish = lastStop(stops);
  return {
    id: item.id,
    reference: item.reference,
    clientName: item.clientName ?? "",
    clientPhone: item.clientPhone ?? "",
    pickupAddress: item.pickupAddress ?? "",
    dropoffAddress: finish?.address || item.dropoffAddress || "",
    pickupLat: item.pickupLat ?? null,
    pickupLng: item.pickupLng ?? null,
    dropoffLat: finish?.lat ?? item.dropoffLat ?? null,
    dropoffLng: finish?.lng ?? item.dropoffLng ?? null,
    stops,
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
    assignedDriverPhone: item.assignedDriverPhone?.trim() || null,
    vehicleType,
    vehiclePlate: item.vehiclePlate ? normalizePlate(item.vehiclePlate) : null,
    trailerPlates: normalizeTrailerPlates(item.trailerPlates),
    status,
    startedAt: item.startedAt ?? null,
    finishedAt: item.finishedAt ?? null,
    createdByAdminId: item.createdByAdminId?.trim() || null,
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
  const mine = listCourses().filter((course) => course.assignedDeviceId === driverId);
  const live = liveJobsForDriver(mine, driverId);
  const history = mine.filter((course) => course.status === "done" || course.status === "cancelled");
  return [...live, ...history];
}

function assertCanAssign(driverId: string, exceptCourseId?: string) {
  if (!isDriverAtCapacity(listCourses(), driverId, exceptCourseId)) return;
  const held = liveJobsForDriver(listCourses(), driverId, exceptCourseId);
  const account = getDriver(driverId);
  throw new CourseAssignError(assignmentBlockedMessage(held, account?.callSign));
}

function assertCanStart(course: Course) {
  if (!course.assignedDeviceId) return;
  const blocking = inProgressJobForDriver(listCourses(), course.assignedDeviceId, course.id);
  if (!blocking) return;
  throw new CourseStartError(
    `Terminez d’abord ${blocking.reference} avant de démarrer ${course.reference}.`,
  );
}

export function getCourse(id: string) {
  return courses.get(id) ?? null;
}

function emptyVehicle(course: Course): Course {
  return {
    ...course,
    vehicleType: null,
    vehiclePlate: null,
    trailerPlates: [],
    assignedDriverPhone: null,
  };
}

function vehicleFromDriver(
  course: Course,
  deviceId: string,
  overlay?: {
    vehicleType?: VehicleType | null;
    vehiclePlate?: string | null;
    trailerPlates?: string[] | null;
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
  const trailerPlates =
    overlay?.trailerPlates !== undefined
      ? normalizeTrailerPlates(overlay.trailerPlates)
      : (account?.trailerPlates ?? course.trailerPlates ?? []);
  return {
    ...course,
    assignedDeviceId: deviceId,
    assignedCallSign: device?.callSign ?? account?.callSign ?? course.assignedCallSign,
    assignedDriverName: device?.driverName ?? account?.driverName ?? course.assignedDriverName,
    assignedDriverPhone: account?.phone || course.assignedDriverPhone,
    vehicleType,
    vehiclePlate,
    trailerPlates,
  };
}

function applyAssignment(
  course: Course,
  deviceId: string | null,
  overlay?: {
    vehicleType?: VehicleType | null;
    vehiclePlate?: string | null;
    trailerPlates?: string[] | null;
  },
): Course {
  if (!deviceId) {
    return emptyVehicle({
      ...course,
      assignedDeviceId: null,
      assignedCallSign: null,
      assignedDriverName: null,
      assignedDriverPhone: null,
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

function notifyAssigned(course: Course) {
  if (!course.assignedDeviceId) return;
  if (course.status !== "assigned" && course.status !== "en_route") return;
  addNotification({
    kind: "course_assigned",
    courseId: course.id,
    reference: course.reference,
    title: `Nouvelle course ${course.reference}`,
    body: `${course.clientName} · ${tourLine(course)}`,
    targetRole: "driver",
    targetId: course.assignedDeviceId,
    unique: "unread",
  });
}

function notifyDone(course: Course) {
  if (!course.createdByAdminId) return;
  const driver = course.assignedDriverName
    ? `${course.assignedCallSign ?? ""} — ${course.assignedDriverName}`.replace(/^ — /, "")
    : "Le chauffeur";
  addNotification({
    kind: "course_done",
    courseId: course.id,
    reference: course.reference,
    title: `Course terminée ${course.reference}`,
    body: `${driver} a terminé ${course.clientName}.`,
    targetRole: "dispatcher",
    targetId: course.createdByAdminId,
    unique: "always",
  });
}

export function createCourse(draft: CourseDraft): Course {
  const id = crypto.randomUUID();
  const reference = `CCMM-${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  const now = Date.now();
  const stops = normalizeStops({
    stops: draft.stops,
    dropoffAddress: draft.dropoffAddress,
    dropoffLat: draft.dropoffLat,
    dropoffLng: draft.dropoffLng,
  });
  const finish = lastStop(stops);
  let course: Course = {
    id,
    reference,
    clientName: draft.clientName.trim(),
    clientPhone: (draft.clientPhone ?? "").trim(),
    pickupAddress: draft.pickupAddress.trim(),
    dropoffAddress: (finish?.address || draft.dropoffAddress).trim(),
    pickupLat: draft.pickupLat ?? null,
    pickupLng: draft.pickupLng ?? null,
    dropoffLat: finish?.lat ?? draft.dropoffLat ?? null,
    dropoffLng: finish?.lng ?? draft.dropoffLng ?? null,
    stops,
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
    assignedDriverPhone: null,
    vehicleType: null,
    vehiclePlate: null,
    trailerPlates: [],
    status: "open",
    startedAt: null,
    finishedAt: null,
    createdByAdminId: draft.createdByAdminId?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  if (draft.assignedDeviceId) {
    assertCanAssign(draft.assignedDeviceId);
    course = applyAssignment(course, draft.assignedDeviceId, {
      vehicleType: draft.vehicleType,
      vehiclePlate: draft.vehiclePlate,
      trailerPlates: draft.trailerPlates,
    });
  }
  courses.set(course.id, course);
  save();
  notifyAssigned(course);
  return course;
}

export function updateCourse(id: string, patch: CoursePatch): Course | null {
  const existing = courses.get(id);
  if (!existing) return null;
  const previousAssigned = existing.assignedDeviceId;
  const previousStatus = existing.status;
  let next = { ...existing, updatedAt: Date.now() };
  if (patch.assignedDeviceId !== undefined) {
    if (patch.assignedDeviceId && patch.assignedDeviceId !== existing.assignedDeviceId) {
      assertCanAssign(patch.assignedDeviceId, id);
    }
    next = applyAssignment(next, patch.assignedDeviceId, {
      vehicleType: patch.vehicleType,
      vehiclePlate: patch.vehiclePlate,
      trailerPlates: patch.trailerPlates,
    });
  } else {
    if (patch.vehicleType !== undefined) next.vehicleType = patch.vehicleType;
    if (patch.vehiclePlate !== undefined) {
      next.vehiclePlate = patch.vehiclePlate ? normalizePlate(patch.vehiclePlate) : null;
    }
    if (patch.trailerPlates !== undefined) {
      next.trailerPlates = normalizeTrailerPlates(patch.trailerPlates);
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
      assertCanStart(next);
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
  if (next.assignedDeviceId && next.assignedDeviceId !== previousAssigned) {
    notifyAssigned(next);
  }
  if (next.status === "done" && previousStatus !== "done") {
    notifyDone(next);
  }
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
