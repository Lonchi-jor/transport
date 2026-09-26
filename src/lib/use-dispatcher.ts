"use client";

import { useSyncExternalStore } from "react";
import { readDispatcherId, subscribeDispatcher } from "@/lib/dispatcher";

export function useDispatcherId() {
  return useSyncExternalStore(subscribeDispatcher, readDispatcherId, () => "");
}
