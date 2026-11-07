import type { TileAppearance } from '../../../shared/types/dashboard';

/** IDs are dictionary keys. Only an explicitly authored string is an override.
 * Preserve empty/whitespace strings; each caller keeps its existing blank-label
 * policy. Never repair or mutate the recorded appearance while reading it. */
export function ownAxisLabel(appearance: Pick<TileAppearance,'axisLabelOverrides'>,id:string):string|undefined {
  const labels=appearance.axisLabelOverrides;
  if(!labels||typeof labels!=='object'||!Object.prototype.hasOwnProperty.call(labels,id))return undefined;
  const value=labels[id];return typeof value==='string'?value:undefined;
}
