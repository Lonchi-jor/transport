const KEY = "ccmm-dispatcher-id";
const listeners = new Set<() => void>();

function readStoredId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEY)?.trim() ?? "";
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeDispatcher(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined" && !readStoredId()) {
    window.localStorage.setItem(KEY, crypto.randomUUID());
  }
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function readDispatcherId() {
  return readStoredId();
}

export function ensureDispatcherId() {
  if (typeof window === "undefined") return "";
  let id = readStoredId();
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
    emit();
  }
  return id;
}
