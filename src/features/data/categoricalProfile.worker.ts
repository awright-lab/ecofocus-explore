import type { ImportedDatasetField } from "../../../shared/types/dashboard";
import { buildCategoricalProfileFromValues } from "./importedCategoricalProfile";
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ values: string[]; field: ImportedDatasetField }>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = event => {
  try { scope.postMessage({ type: "complete", profile: buildCategoricalProfileFromValues(event.data.values, event.data.field) }); }
  catch { scope.postMessage({ type: "failed" }); }
};
