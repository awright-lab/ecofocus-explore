import type { DashboardWorkspace } from "../../../shared/types/dashboard";

// Cancellation revokes UI ownership; it cannot undo an in-flight storage write.
// The storage session remains responsible for serialization and recovery data.
export function scheduleAcknowledgedWorkspaceAutosave(options: {
  capture: () => DashboardWorkspace;
  onCaptured: (workspace: DashboardWorkspace) => void;
  save: (workspace: DashboardWorkspace) => Promise<boolean>;
  onRejected: (workspace: DashboardWorkspace) => void;
  onState: (state: "Saving..." | "Not saved" | "Saved just now" | "Saved locally") => void;
}) {
  let active = true;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  options.onState("Saving...");
  const saveTimer = setTimeout(async () => {
    let captured: DashboardWorkspace | undefined;
    try {
      captured = options.capture();
      options.onCaptured(captured);
      const saved = await options.save(captured);
      if (!active) return;
      if (!saved) { options.onState("Not saved"); return; }
      options.onState("Saved just now");
      settleTimer = setTimeout(() => { if (active) options.onState("Saved locally"); }, 2200);
    } catch {
      if (!active) return;
      if (captured) options.onRejected(captured);
      options.onState("Not saved");
    }
  }, 900);
  return () => {
    active = false;
    clearTimeout(saveTimer);
    if (settleTimer !== undefined) clearTimeout(settleTimer);
  };
}
