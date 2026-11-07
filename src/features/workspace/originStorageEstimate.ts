export type OriginStorageEstimate = { status: "available"; usage: number; quota: number; fraction: number; nearQuota: boolean } | { status: "unavailable"; reason: string };
// Read only. Browser managed-storage estimates are not localStorage limits and
// must never be used as permission to save, delete or request persistence.
export async function readOriginStorageEstimate(): Promise<OriginStorageEstimate> {
  try {
    if (typeof navigator === "undefined" || typeof navigator.storage?.estimate !== "function") return { status: "unavailable", reason: "This browser does not expose a storage estimate. Available save space is unknown." };
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== "number" || !Number.isFinite(usage) || usage < 0 || typeof quota !== "number" || !Number.isFinite(quota) || quota <= 0 || !Number.isFinite(usage / quota)) return { status: "unavailable", reason: "The browser returned an incomplete storage estimate. Available save space is unknown." };
    const fraction = usage / quota;
    return { status: "available", usage, quota, fraction, nearQuota: fraction >= 0.85 };
  } catch { return { status: "unavailable", reason: "The browser storage estimate could not be read. Available save space is unknown." }; }
}
