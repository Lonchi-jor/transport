import type { FleetDevice, HeartbeatPayload, VehicleType } from "./types";

const STALE_MS = 20_000;
const devices = new Map<string, FleetDevice>();

type DemoRoute = {
  id: string;
  callSign: string;
  driverName: string;
  vehicleType: VehicleType;
  path: [number, number][];
  speedMps: number;
};

const NAIROBI: [number, number][][] = [
  [
    [-1.286389, 36.817223],
    [-1.2833, 36.8224],
    [-1.2798, 36.8169],
    [-1.2734, 36.8112],
    [-1.2699, 36.8071],
    [-1.2738, 36.8014],
    [-1.2802, 36.8058],
    [-1.286389, 36.817223],
  ],
  [
    [-1.2921, 36.8219],
    [-1.2974, 36.8122],
    [-1.3031, 36.8076],
    [-1.2988, 36.7984],
    [-1.2894, 36.8029],
    [-1.2842, 36.8116],
    [-1.2921, 36.8219],
  ],
  [
    [-1.265, 36.834],
    [-1.2712, 36.8284],
    [-1.2786, 36.8241],
    [-1.2862, 36.8288],
    [-1.2926, 36.8349],
    [-1.2834, 36.8392],
    [-1.265, 36.834],
  ],
  [
    [-1.3004, 36.7842],
    [-1.2941, 36.7926],
    [-1.2886, 36.8011],
    [-1.2839, 36.8088],
    [-1.2898, 36.8144],
    [-1.2966, 36.8062],
    [-1.3004, 36.7842],
  ],
];

const DEMO_ROUTES: DemoRoute[] = [
  {
    id: "demo-bus-12",
    callSign: "BUS-12",
    driverName: "Amina Otieno",
    vehicleType: "bus",
    path: NAIROBI[0],
    speedMps: 9.2,
  },
  {
    id: "demo-taxi-04",
    callSign: "TAXI-04",
    driverName: "Kwame Mensah",
    vehicleType: "taxi",
    path: NAIROBI[1],
    speedMps: 11.4,
  },
  {
    id: "demo-trk-88",
    callSign: "TRK-88",
    driverName: "Priya Shah",
    vehicleType: "truck",
    path: NAIROBI[2],
    speedMps: 7.1,
  },
  {
    id: "demo-van-21",
    callSign: "VAN-21",
    driverName: "Luis Romero",
    vehicleType: "van",
    path: NAIROBI[3],
    speedMps: 10.0,
  },
];

let demoTimer: ReturnType<typeof setInterval> | null = null;
let demoStartedAt = 0;

function haversineMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearing(a: [number, number], b: [number, number]) {
  const φ1 = (a[0] * Math.PI) / 180;
  const φ2 = (b[0] * Math.PI) / 180;
  const Δλ = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function pointAlong(path: [number, number][], distanceM: number) {
  let remaining = distanceM;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += haversineMeters(path[i], path[i + 1]);
  }
  if (total <= 0) {
    return { point: path[0], heading: 0 };
  }
  remaining = remaining % total;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = haversineMeters(path[i], path[i + 1]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      const lat = path[i][0] + (path[i + 1][0] - path[i][0]) * t;
      const lng = path[i][1] + (path[i + 1][1] - path[i][1]) * t;
      return { point: [lat, lng] as [number, number], heading: bearing(path[i], path[i + 1]) };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1];
  return { point: last, heading: 0 };
}

function upsertDemoPositions() {
  const elapsedSec = (Date.now() - demoStartedAt) / 1000;
  for (const route of DEMO_ROUTES) {
    const { point, heading } = pointAlong(route.path, elapsedSec * route.speedMps);
    devices.set(route.id, {
      id: route.id,
      callSign: route.callSign,
      driverName: route.driverName,
      vehicleType: route.vehicleType,
      vehiclePlate: null,
      vehicleLabel: null,
      role: "driver",
      lat: point[0],
      lng: point[1],
      heading,
      speedMps: route.speedMps,
      accuracy: 8,
      sharing: true,
      simulated: true,
      lastSeen: Date.now(),
    });
  }
}

export function pruneStale(now = Date.now()) {
  for (const [id, device] of devices) {
    if (id.startsWith("demo-")) continue;
    if (now - device.lastSeen > STALE_MS) {
      devices.delete(id);
    }
  }
}

export function listDevices(): FleetDevice[] {
  pruneStale();
  return [...devices.values()].sort((a, b) => a.callSign.localeCompare(b.callSign));
}

export function heartbeat(payload: HeartbeatPayload): FleetDevice {
  const existing = devices.get(payload.id);
  const device: FleetDevice = {
    id: payload.id,
    callSign: payload.callSign.trim().toUpperCase() || "UNIT",
    driverName: payload.driverName.trim() || "Unknown",
    vehicleType: payload.vehicleType,
    vehiclePlate: payload.vehiclePlate?.trim() || existing?.vehiclePlate || null,
    vehicleLabel: payload.vehicleLabel?.trim() || existing?.vehicleLabel || null,
    role: payload.role,
    lat: payload.lat ?? existing?.lat ?? null,
    lng: payload.lng ?? existing?.lng ?? null,
    heading: payload.heading ?? existing?.heading ?? null,
    speedMps: payload.speedMps ?? existing?.speedMps ?? null,
    accuracy: payload.accuracy ?? existing?.accuracy ?? null,
    sharing: payload.sharing ?? existing?.sharing ?? false,
    simulated: payload.simulated ?? existing?.simulated ?? false,
    lastSeen: Date.now(),
  };
  devices.set(device.id, device);
  return device;
}

export function getDevice(id: string) {
  pruneStale();
  return devices.get(id) ?? null;
}

export function removeDevice(id: string) {
  devices.delete(id);
}

export function isDemoRunning() {
  return demoTimer !== null;
}

export function startDemoFleet() {
  if (demoTimer) return listDevices();
  demoStartedAt = Date.now();
  upsertDemoPositions();
  demoTimer = setInterval(upsertDemoPositions, 1000);
  return listDevices();
}

export function stopDemoFleet() {
  if (demoTimer) {
    clearInterval(demoTimer);
    demoTimer = null;
  }
  for (const id of [...devices.keys()]) {
    if (id.startsWith("demo-")) devices.delete(id);
  }
  return listDevices();
}
