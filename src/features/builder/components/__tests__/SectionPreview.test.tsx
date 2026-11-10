import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SectionPreview } from "../SectionPreview";
import { sectionBlocks } from "./sectionLibraryFixture";
it("renders stored coordinates, transparency, z-order and custom bounds without changing objects", () => {
  const block = sectionBlocks(1)[0], before = structuredClone(block);
  const svg = renderToStaticMarkup(<SectionPreview block={block}/>);
  expect(svg).toContain('viewBox="0 0 800 300"'); expect(svg).toContain('fill="transparent"');
  expect(svg.indexOf('data-preview-object="shape-0"')).toBeLessThan(svg.indexOf('data-preview-object="text-0"'));
  expect(svg).toContain('x="400" y="50" width="360" height="160"'); expect(block).toEqual(before);
  block.items[0].relativeLayout = { x: -30, y: 800, width: 1500, height: 170, zIndex: 2 };
  expect(renderToStaticMarkup(<SectionPreview block={block}/>)).toContain('viewBox="-30 0 1500 970"');
  const shape = block.items[1]; if (shape.kind === "element") shape.element.hidden = true;
  expect(renderToStaticMarkup(<SectionPreview block={block}/>)).not.toContain('data-preview-object="shape-0"');
});
