import type { VehicleType } from "@/lib/types";

export type RosterDriver = {
  id: string;
  callSign: string;
  driverName: string;
  phone?: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;
  pin?: string;
};
