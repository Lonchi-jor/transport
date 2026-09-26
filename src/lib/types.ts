export const VEHICLE_TYPES = ["bus", "taxi", "truck", "van", "bike"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const ROLES = ["driver", "dispatcher"] as const;
export type Role = (typeof ROLES)[number];

export type FleetDevice = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate: string | null;
  vehicleLabel: string | null;
  role: Role;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speedMps: number | null;
  accuracy: number | null;
  sharing: boolean;
  simulated: boolean;
  lastSeen: number;
};

export type HeartbeatPayload = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  vehiclePlate?: string | null;
  vehicleLabel?: string | null;
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
  vehicleType: VehicleType | null;
  vehiclePlate: string | null;
  vehicleLabel: string | null;
  status: CourseStatus;
  startedAt: number | null;
  finishedAt: number | null;
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
  routePath?: [number, number][];
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  notes?: string;
  scheduledAt?: string | null;
  assignedDeviceId?: string | null;
  vehicleType?: VehicleType | null;
  vehiclePlate?: string | null;
  vehicleLabel?: string | null;
};

export type CoursePatch = {
  assignedDeviceId?: string | null;
  status?: CourseStatus;
  bnNumber?: string;
  notes?: string;
  vehicleType?: VehicleType | null;
  vehiclePlate?: string | null;
  vehicleLabel?: string | null;
};

export type FleetSnapshot = {
  devices: FleetDevice[];
  courses?: Course[];
  drivers?: {
    id: string;
    callSign: string;
    driverName: string;
    vehicleType: VehicleType;
    vehiclePlate?: string;
    vehicleLabel?: string;
    pin?: string;
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
