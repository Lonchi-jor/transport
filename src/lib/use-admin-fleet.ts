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
  const [now, setNow] = useState(() => Date.now());
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

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(tick);
  }, []);

  const dismissAlerts = useCallback(
    async (input: { ids?: string[]; courseId?: string } = {}, targetId = dispatcherId) => {
      if (!targetId) return;
      const ids = input.ids ?? [];
      if (!ids.length && !input.courseId) return;
      setNotifications((prev) =>
        prev.filter((item) => {
          if (item.targetId !== targetId) return true;
          if (ids.length && ids.includes(item.id)) return false;
          if (input.courseId && item.courseId === input.courseId && item.kind === "course_done") return false;
          return true;
        }),
      );
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetId,
            ids: ids.length ? ids : undefined,
            courseId: input.courseId,
            kind: input.courseId ? "course_done" : undefined,
          }),
        });
        if (res.ok) applySnapshot((await res.json()) as FleetSnapshot);
      } catch {
        /* keep optimistic */
      }
    },
    [applySnapshot, dispatcherId],
  );

  const markAlertsRead = useCallback(
    async (ids: string[], targetId = dispatcherId) => {
      await dismissAlerts({ ids }, targetId);
    },
    [dismissAlerts, dispatcherId],
  );

  const alerts = useMemo(
    () =>
      notifications.filter(
        (item) => item.kind === "course_done" && item.targetId === dispatcherId && !item.readAt,
      ),
    [notifications, dispatcherId],
  );

  const liveJobs = useMemo(() => activeCourses(courses), [courses]);
  const liveById = useMemo(() => {
    const map = new Map<string, FleetDevice>();
    for (const device of devices) {
      if (device.role === "driver" && device.connected) map.set(device.id, device);
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
    dismissAlerts,
  };
}
