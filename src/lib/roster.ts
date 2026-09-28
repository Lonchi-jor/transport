import type { TrailerUnit, VehicleType } from "@/lib/types";

export type RosterDriver = {
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
};
