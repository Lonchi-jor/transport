import type { Course } from "./types";

export class CourseAssignError extends Error {
  readonly code = "DRIVER_BUSY" as const;
  constructor(message: string) {
    super(message);
    this.name = "CourseAssignError";
  }
}

export function isHandsFullStatus(status: Course["status"]) {
  return status === "assigned" || status === "en_route";
}

export function heldCourseForDriver(
  courses: Course[],
  driverId: string,
  exceptCourseId?: string | null,
): Course | null {
  const id = driverId.trim();
  if (!id) return null;
  return (
    courses.find(
      (course) =>
        course.assignedDeviceId === id &&
        isHandsFullStatus(course.status) &&
        course.id !== exceptCourseId,
    ) ?? null
  );
}

export function assignmentBlockedMessage(held: Course, callSign?: string | null) {
  const who = callSign?.trim() ? callSign.trim() : "ce chauffeur";
  return `Impossible d’attribuer cette course : ${who} a déjà une course sur la main (${held.reference}).`;
}

export function isCourseAssignError(error: unknown): error is CourseAssignError {
  return (
    error instanceof CourseAssignError ||
    (error instanceof Error && (error as { code?: string }).code === "DRIVER_BUSY")
  );
}
