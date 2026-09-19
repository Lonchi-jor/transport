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
  bus: { label: "City bus", color: "#f5b942", short: "BUS" },
  taxi: { label: "Taxi", color: "#f4d35e", short: "TXI" },
  truck: { label: "Freight truck", color: "#5b8def", short: "TRK" },
  van: { label: "Shuttle van", color: "#3ecfb2", short: "VAN" },
  bike: { label: "Courier bike", color: "#7ad16a", short: "BKE" },
};
