"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppNotification, Course, FleetDevice, FleetSnapshot } from "@/lib/types";
import type { RosterDriver } from "@/lib/roster";
import { activeCourses } from "@/lib/format";
import { useDispatcherId } from "@/lib/use-dispatcher";

export function useAdminFleet() {
  const dispatcherId = useDispatcherId();
  const [devices, setDevices] = useState<FleetDevice[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [roster, setRoster] = useState<RosterDriver[]>([]);
  const [now, setNow] = useState(0);
  const [online, setOnline] = useState(true);

  const applySnapshot = useCallback((snapshot: FleetSnapshot) => {
    setDevices(snapshot.devices);
    setCourses(snapshot.courses ?? []);
    setNotifications(snapshot.notifications ?? []);
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

  const markAlertsRead = useCallback(
    async (ids: string[], targetId = dispatcherId) => {
      if (!ids.length || !targetId) return;
      setNotifications((prev) =>
        prev.map((item) =>
          ids.includes(item.id) && item.targetId === targetId
            ? { ...item, readAt: item.readAt ?? Date.now() }
            : item,
        ),
      );
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, targetId }),
        });
        if (res.ok) applySnapshot((await res.json()) as FleetSnapshot);
      } catch {
        /* keep optimistic */
      }
    },
    [applySnapshot, dispatcherId],
  );

  const alerts = useMemo(
    () =>
      notifications.filter(
        (item) => item.kind === "course_done" && item.targetId === dispatcherId,
      ),
    [notifications, dispatcherId],
  );

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
    notifications,
    alerts,
    dispatcherId,
    roster,
    setRoster,
    now,
    online,
    liveJobs,
    liveById,
    onlineCount,
    applySnapshot,
    markAlertsRead,
  };
}
