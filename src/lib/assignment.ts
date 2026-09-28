import type { Course } from "./types";

export const MAX_LIVE_JOBS = 2;

export class CourseAssignError extends Error {
  readonly code = "DRIVER_BUSY" as const;
  constructor(message: string) {
    super(message);
    this.name = "CourseAssignError";
  }
}

export class CourseStartError extends Error {
  readonly code = "COURSE_IN_PROGRESS" as const;
  constructor(message: string) {
    super(message);
    this.name = "CourseStartError";
  }
}

export function isHandsFullStatus(status: Course["status"]) {
  return status === "assigned" || status === "en_route";
}

export function liveJobsForDriver(
  courses: Course[],
  driverId: string,
  exceptCourseId?: string | null,
): Course[] {
  const id = driverId.trim();
  if (!id) return [];
  return courses
    .filter(
      (course) =>
        course.assignedDeviceId === id &&
        isHandsFullStatus(course.status) &&
        course.id !== exceptCourseId,
    )
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "en_route" ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
}

export function isDriverAtCapacity(
  courses: Course[],
  driverId: string,
  exceptCourseId?: string | null,
) {
  return liveJobsForDriver(courses, driverId, exceptCourseId).length >= MAX_LIVE_JOBS;
}

export function inProgressJobForDriver(
  courses: Course[],
  driverId: string,
  exceptCourseId?: string | null,
): Course | null {
  return liveJobsForDriver(courses, driverId, exceptCourseId).find((course) => course.status === "en_route") ?? null;
}

export function assignmentBlockedMessage(held: Course[], callSign?: string | null) {
  const who = callSign?.trim() ? callSign.trim() : "ce chauffeur";
  const refs = held.map((course) => course.reference).join(", ");
  return `Impossible d’attribuer cette course : ${who} a déjà deux courses sur la main (${refs}).`;
}

export function startBlockedMessage(held: Course, nextReference?: string | null) {
  const next = nextReference?.trim();
  return next
    ? `Terminez d’abord ${held.reference} avant de démarrer ${next}.`
    : `Terminez d’abord ${held.reference} avant de démarrer cette course.`;
}

export function isCourseAssignError(error: unknown): error is CourseAssignError {
  return (
    error instanceof CourseAssignError ||
    (error instanceof Error && (error as { code?: string }).code === "DRIVER_BUSY")
  );
}

export function isCourseStartError(error: unknown): error is CourseStartError {
  return (
    error instanceof CourseStartError ||
    (error instanceof Error && (error as { code?: string }).code === "COURSE_IN_PROGRESS")
  );
}

export function isCourseRuleError(error: unknown): error is CourseAssignError | CourseStartError {
  return isCourseAssignError(error) || isCourseStartError(error);
}
