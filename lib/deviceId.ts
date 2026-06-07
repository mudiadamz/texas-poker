"use client";

const KEY = "texas-poker.device-id";

/**
 * Stable per-browser identifier used by the single-session guard.
 * Each browser/profile gets its own UUID — tabs inside the same browser
 * share localStorage so they share the device ID and don't kick each
 * other out.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}
