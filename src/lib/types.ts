export const VEHICLE_TYPES = ["bus", "taxi", "truck", "van", "bike"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const ROLES = ["driver", "dispatcher"] as const;
export type Role = (typeof ROLES)[number];

export type FleetDevice = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
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
  role: Role;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  speedMps?: number | null;
  accuracy?: number | null;
  sharing?: boolean;
  simulated?: boolean;
};

export type FleetSnapshot = {
  devices: FleetDevice[];
  now: number;
};

export const VEHICLE_META: Record<
  VehicleType,
  { label: string; color: string; short: string }
> = {
  bus: { label: "City bus", color: "#00a4e8", short: "BUS" },
  taxi: { label: "Taxi", color: "#2b308f", short: "TXI" },
  truck: { label: "Freight truck", color: "#4d7fe8", short: "TRK" },
  van: { label: "Shuttle van", color: "#1a9fe0", short: "VAN" },
  bike: { label: "Courier bike", color: "#6c74d4", short: "BKE" },
};
