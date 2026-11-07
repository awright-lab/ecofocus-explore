import { buildNumericProfileFromValues } from "./importedNumericProfile";
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ values: string[] }>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = event => {
  try { scope.postMessage({ type: "complete", profile: buildNumericProfileFromValues(event.data.values) }); }
  catch { scope.postMessage({ type: "failed" }); }
};
