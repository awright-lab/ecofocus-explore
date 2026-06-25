import { canvasHeight, canvasWidth } from "../builderConstants";
import type { CanvasLayout } from "../../../../shared/types/dashboard";

export interface CompositionGuideObject {
  id: string;
  type: "tile" | "element";
  layout: CanvasLayout;
}

export interface CompositionGuideLine {
  orientation: "vertical" | "horizontal";
  position: number;
  label: string;
}

export interface CompositionGuideState {
  guides: CompositionGuideLine[];
  snappedX: number;
  snappedY: number;
  snapLabel: string;
}

type AxisTarget = {
  position: number;
  label: string;
};

function axisTargets(objects: CompositionGuideObject[], movingObject: CompositionGuideObject, axis: "x" | "y"): AxisTarget[] {
  const isX = axis === "x";
  const pageSize = isX ? canvasWidth : canvasHeight;
  const targets: AxisTarget[] = [
    { position: 0, label: isX ? "Page left" : "Page top" },
    { position: pageSize / 2, label: isX ? "Page center" : "Page middle" },
    { position: pageSize, label: isX ? "Page right" : "Page bottom" }
  ];

  objects
    .filter((object) => object.id !== movingObject.id || object.type !== movingObject.type)
    .forEach((object) => {
      const start = isX ? object.layout.x : object.layout.y;
      const size = isX ? object.layout.width : object.layout.height;
      const name = object.type === "tile" ? "Tile" : "Element";
      targets.push(
        { position: start, label: `${name} edge` },
        { position: start + size / 2, label: `${name} center` },
        { position: start + size, label: `${name} edge` }
      );
    });

  return targets;
}

function nearestAxisSnap(
  movingStart: number,
  movingSize: number,
  targets: AxisTarget[],
  threshold: number
) {
  const movingAnchors = [
    { position: movingStart, offset: 0 },
    { position: movingStart + movingSize / 2, offset: movingSize / 2 },
    { position: movingStart + movingSize, offset: movingSize }
  ];

  return movingAnchors
    .flatMap((anchor) =>
      targets.map((target) => ({
        distance: Math.abs(anchor.position - target.position),
        snappedStart: target.position - anchor.offset,
        target
      }))
    )
    .filter((candidate) => candidate.distance <= threshold)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function buildCompositionGuideState({
  movingObject,
  objects,
  threshold = 7
}: {
  movingObject: CompositionGuideObject;
  objects: CompositionGuideObject[];
  threshold?: number;
}): CompositionGuideState {
  const verticalSnap = nearestAxisSnap(
    movingObject.layout.x,
    movingObject.layout.width,
    axisTargets(objects, movingObject, "x"),
    threshold
  );
  const horizontalSnap = nearestAxisSnap(
    movingObject.layout.y,
    movingObject.layout.height,
    axisTargets(objects, movingObject, "y"),
    threshold
  );
  const guides: CompositionGuideLine[] = [
    verticalSnap
      ? {
          orientation: "vertical" as const,
          position: verticalSnap.target.position,
          label: verticalSnap.target.label
        }
      : null,
    horizontalSnap
      ? {
          orientation: "horizontal" as const,
          position: horizontalSnap.target.position,
          label: horizontalSnap.target.label
        }
      : null
  ].filter(Boolean) as CompositionGuideLine[];

  return {
    guides,
    snappedX: verticalSnap ? Math.round(verticalSnap.snappedStart) : Math.round(movingObject.layout.x),
    snappedY: horizontalSnap ? Math.round(horizontalSnap.snappedStart) : Math.round(movingObject.layout.y),
    snapLabel: guides.map((guide) => guide.label).join(" + ")
  };
}

export function buildCompositionGuideObjects(objects: CompositionGuideObject[]) {
  return objects.filter((object) => object.layout.width > 0 && object.layout.height > 0);
}
