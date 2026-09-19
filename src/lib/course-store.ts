import type { Course, CourseDraft, CourseStatus } from "./types";
import { COURSE_STATUSES } from "./types";
import { getDevice } from "./fleet-store";

const courses = new Map<string, Course>();
let nextNumber = 1;

export function listCourses(): Course[] {
  return [...courses.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getCourse(id: string) {
  return courses.get(id) ?? null;
}

function applyAssignment(course: Course, deviceId: string | null): Course {
  if (!deviceId) {
    return {
      ...course,
      assignedDeviceId: null,
      assignedCallSign: null,
      assignedDriverName: null,
      status: course.status === "done" || course.status === "cancelled" ? course.status : "open",
      updatedAt: Date.now(),
    };
  }
  const device = getDevice(deviceId);
  return {
    ...course,
    assignedDeviceId: deviceId,
    assignedCallSign: device?.callSign ?? course.assignedCallSign,
    assignedDriverName: device?.driverName ?? course.assignedDriverName,
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
    notes: (draft.notes ?? "").trim(),
    scheduledAt: draft.scheduledAt || null,
    assignedDeviceId: null,
    assignedCallSign: null,
    assignedDriverName: null,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  if (draft.assignedDeviceId) {
    course = applyAssignment(course, draft.assignedDeviceId);
  }
  courses.set(course.id, course);
  return course;
}

export function updateCourse(
  id: string,
  patch: {
    assignedDeviceId?: string | null;
    status?: CourseStatus;
  },
): Course | null {
  const existing = courses.get(id);
  if (!existing) return null;
  let next = { ...existing, updatedAt: Date.now() };
  if (patch.assignedDeviceId !== undefined) {
    next = applyAssignment(next, patch.assignedDeviceId);
  }
  if (patch.status) {
    next.status = patch.status;
    next.updatedAt = Date.now();
  }
  courses.set(id, next);
  return next;
}

export function isCourseStatus(value: unknown): value is CourseStatus {
  return typeof value === "string" && (COURSE_STATUSES as readonly string[]).includes(value);
}
