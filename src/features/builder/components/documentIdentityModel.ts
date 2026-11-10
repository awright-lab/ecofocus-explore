export type DocumentSaveStateTone = "saving" | "saved" | "error";

export type DocumentSaveStateView = {
  label: string;
  helper: string;
  tone: DocumentSaveStateTone;
  showSpinner: boolean;
};

export function normalizeDocumentTitle(value: string, fallback: string) {
  const title = value.trim();
  return title || fallback.trim() || "Untitled report";
}

export function buildDocumentSaveStateView(saveState: string): DocumentSaveStateView {
  const normalized = saveState.toLowerCase();

  if (normalized.includes("error") || normalized.includes("not saved")) {
    return {
      label: "Changes not saved",
      helper: "Local draft could not be saved. Retry saving or download a workspace backup.",
      tone: "error",
      showSpinner: false
    };
  }

  if (normalized.includes("saving")) {
    return {
      label: "Saving",
      helper: "Updating local draft...",
      tone: "saving",
      showSpinner: true
    };
  }

  if (normalized.includes("just now")) {
    return {
      label: "Saved just now",
      helper: "Local draft autosaved.",
      tone: "saved",
      showSpinner: false
    };
  }

  return {
    label: "Saved locally",
    helper: "Stored in this browser.",
    tone: "saved",
    showSpinner: false
  };
}
