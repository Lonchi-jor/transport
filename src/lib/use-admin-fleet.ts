"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Course, FleetDevice, FleetSnapshot } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import { activeCourses } from "@/lib/format";

export function useAdminFleet() {
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [roster, setRoster] = useState<RosterDriver[]>([]);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);

  const applySnapshot = useCallback((snapshot: FleetSnapshot) => {
    setDevices(snapshot.devices);
    setCourses(snapshot.courses ?? []);
    setNow(snapshot.now);
    setOnline(true);
    if (snapshot.drivers) {
      setRoster((prev) =>
        snapshot.drivers!.map((driver) => ({
          ...driver,
          pin: driver.pin ?? prev.find((item) => item.id === driver.id)?.pin,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void fetch("/api/drivers")
      .then((res) => res.json())
      .then((data: FleetSnapshot) => {
        applySnapshot(data);
        if (data.drivers) setRoster(data.drivers);
      })
      .catch(() => undefined);
  }, [applySnapshot]);

  useEffect(() => {
    const source = new EventSource("/api/fleet/stream");
    source.onmessage = (event) => {
      try {
        applySnapshot(JSON.parse(event.data) as FleetSnapshot);
      } catch {
        /* ignore */
      }
    };
    source.onerror = () => setOnline(false);
    return () => source.close();
  }, [applySnapshot]);

  const liveJobs = useMemo(() => activeCourses(courses), [courses]);
  const liveById = useMemo(() => {
    const map = new Map<string, FleetDevice>();
    for (const device of devices) {
      if (device.role === "driver") map.set(device.id, device);
    }
    return map;
  }, [devices]);
  const onlineCount = useMemo(
    () => roster.filter((driver) => liveById.has(driver.id)).length,
    [roster, liveById],
  );

  return {
    devices,
    courses,
    roster,
    setRoster,
    now,
    online,
    liveJobs,
    liveById,
    onlineCount,
    applySnapshot,
  };
}
