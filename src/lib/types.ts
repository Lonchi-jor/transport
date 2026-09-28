export const VEHICLE_TYPES = ["bus", "taxi", "truck", "van", "bike"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const ROLES = ["driver", "dispatcher"] as const;
export type Role = (typeof ROLES)[number];

export type FleetDevice = {
  id: string;
  callSign: string;
  driverName: string;
  phone: string | null;
  vehicleType: VehicleType;
  vehiclePlate: string | null;
  role: Role;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speedMps: number | null;
  accuracy: number | null;
  sharing: boolean;
  simulated: boolean;
  lastSeen: number;
  /** True while the phone is sending heartbeats. Last GPS is kept even when false. */
  connected?: boolean;
};

export type HeartbeatPayload = {
  id: string;
  callSign: string;
  driverName: string;
  phone?: string | null;
  vehicleType: VehicleType;
  vehiclePlate?: string | null;
  role: Role;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  speedMps?: number | null;
  accuracy?: number | null;
  sharing?: boolean;
  simulated?: boolean;
};

export const COURSE_STATUSES = [
  "open",
  "assigned",
  "en_route",
  "done",
  "cancelled",
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export type CourseStop = {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

export const MAX_TOUR_STOPS = 8;
export const MAX_TRAILERS = 4;

export type TrailerUnit = {
  type: VehicleType;
  plate: string;
};

export type Course = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  stops: CourseStop[];
  routePath: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
  bnNumber: string | null;
  hasDeliveryScan: boolean;
  deliveryFileName: string | null;
  deliveryScannedAt: number | null;
  notes: string;
  scheduledAt: string | null;
  assignedDeviceId: string | null;
  assignedCallSign: string | null;
  assignedDriverName: string | null;
  assignedDriverPhone: string | null;
  vehicleType: VehicleType | null;
  vehiclePlate: string | null;
  trailerPlates: string[];
  status: CourseStatus;
  startedAt: number | null;
  finishedAt: number | null;
  createdByAdminId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type CourseDraft = {
  clientName: string;
  clientPhone?: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  stops?: CourseStop[];
  routePath?: [number, number][];
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  notes?: string;
  scheduledAt?: string | null;
  assignedDeviceId?: string | null;
  vehicleType?: VehicleType | null;
  vehiclePlate?: string | null;
  trailerPlates?: string[];
  createdByAdminId?: string | null;
};

export type CoursePatch = {
  assignedDeviceId?: string | null;
  status?: CourseStatus;
  bnNumber?: string;
  notes?: string;
  vehicleType?: VehicleType | null;
  vehiclePlate?: string | null;
  trailerPlates?: string[];
};

export const NOTIFICATION_KINDS = ["course_assigned", "course_done"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
/** Shared inbox so every dispatch desk sees a finished job, not only the browser that created it. */
export const DISPATCH_INBOX = "dispatch";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  courseId: string;
  reference: string;
  title: string;
  body: string;
  targetRole: "driver" | "dispatcher";
  targetId: string;
  createdAt: number;
  readAt: number | null;
};

export type FleetSnapshot = {
  devices: FleetDevice[];
  courses?: Course[];
  notifications?: AppNotification[];
  drivers?: {
    id: string;
    callSign: string;
    driverName: string;
    phone?: string;
    vehicleType: VehicleType;
    vehiclePlate?: string;
    trailerPlates?: string[];
    trailers?: TrailerUnit[];
    pin?: string;
    lastLat?: number | null;
    lastLng?: number | null;
    lastFixAt?: number | null;
    lastSeenAt?: number | null;
  }[];
  now: number;
  demo?: boolean;
};

export const VEHICLE_META: Record<
  VehicleType,
  { label: string; color: string; short: string }
> = {
  bus: { label: "Bus", color: "#00a4e8", short: "BUS" },
  taxi: { label: "Taxi", color: "#2b308f", short: "TXI" },
  truck: { label: "Camion", color: "#4d7fe8", short: "TRK" },
  van: { label: "Fourgon", color: "#1a9fe0", short: "VAN" },
  bike: { label: "Moto", color: "#6c74d4", short: "BKE" },
};
