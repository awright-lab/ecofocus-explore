// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResearchQuestionCatalog } from "../ResearchQuestionCatalog";
import { importDatasetBuffer } from "../../../data/datasetImportModel";

const replay = vi.hoisted(() => ({ generation: 0 }));
// Simulate effect cleanup/setup on the same mounted component and retained
// state. Actual Fast Refresh runtime coverage lives in App/Home/Builder tests.
vi.mock("react", async importOriginal => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useEffect: (effect: Parameters<typeof react.useEffect>[0], dependencies?: Parameters<typeof react.useEffect>[1]) =>
      react.useEffect(effect, dependencies ? [...dependencies, replay.generation] : dependencies),
  };
});

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  replay.generation = 0;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.unstubAllGlobals();
});
function saveButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button => button.textContent?.trim() === "Apply discovery labels")!;
}
async function pendingLabels() {
  const dataset = (await importDatasetBuffer(new TextEncoder().encode("Answer,Region\nYes,North\nNo,South\n").buffer, "synthetic.csv")).dataset!;
  let resolve!: (saved: boolean) => void;
  const update = vi.fn(() => new Promise<boolean>(yes => { resolve = yes; }));
  const render = () => root.render(<ResearchQuestionCatalog importedDatasets={[dataset]} updateImportedDatasetField={update} openGuidedDataQuery={() => {}} applyQuestionSelection={() => {}} onClose={() => {}} />);
  await act(async () => render());
  const study = Array.from(document.querySelectorAll("label")).find(label => label.textContent?.startsWith("Study"))!.querySelector("select")!;
  await act(async () => { study.value = dataset.id; study.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Research questions"] button')!.click());
  await act(async () => saveButton().click());
  expect(update).toHaveBeenCalledOnce();
  expect(saveButton().disabled).toBe(true);
  expect(document.body.textContent).toContain("Saving discovery labels...");
  return { resolve, render };
}

it.each([true, false])("settles label feedback after simulated effect replay (saved=%s)", async saved => {
  const { resolve, render } = await pendingLabels();
  const originalButton = saveButton();
  await act(async () => { replay.generation += 1; render(); });
  expect(saveButton()).toBe(originalButton);
  expect(saveButton().disabled).toBe(true);
  await act(async () => resolve(saved));
  expect(saveButton().disabled).toBe(false);
  expect(document.body.textContent).not.toContain("Saving discovery labels...");
  expect(document.body.textContent).toContain(saved ? "Discovery labels saved in this browser." : "workspace could not be saved");
});

it("does not restore label feedback after actual unmount", async () => {
  const { resolve } = await pendingLabels();
  await act(async () => root.render(<p>Another screen</p>));
  await act(async () => resolve(true));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.textContent).not.toContain("Discovery labels saved");
  expect(host.textContent).toBe("Another screen");
});
