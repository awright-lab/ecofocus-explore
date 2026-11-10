import { useId, useLayoutEffect, useRef, useState } from "react";
import { formatPercentageSample } from "../../../../shared/analytics/percentagePrecision";
import type { NumericDistributionBin } from "../../data/importedNumericProfile";
import { buildNumericDistributionView, distributionRangeLabel, type DistributionView } from "./numericDistributionViewModel";

export function NumericDistribution({ bins, valid, label }: { bins: NumericDistributionBin[]; valid: number; label: string }) {
  const [view, setView] = useState<DistributionView>("count"), id = useId();
  const targetRef = useRef<HTMLElement | null>(null);
  const controls = useRef(new Map<string, HTMLElement>()), displaced = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const previous = displaced.current; displaced.current = null;
    if (previous && !previous.isConnected && (!document.activeElement || document.activeElement === document.body) && targetRef.current?.isConnected && !targetRef.current.closest("[hidden], [inert]")) targetRef.current.focus();
  });
  function controlRef(key: string, node: HTMLElement | null) {
    const previous = controls.current.get(key);
    if (!node && previous === document.activeElement) displaced.current = previous;
    if (node) controls.current.set(key, node); else controls.current.delete(key);
  }
  const model = buildNumericDistributionView(bins, valid);
  if (model.status === "unavailable") return <figure ref={targetRef} tabIndex={-1} aria-label="Numeric distribution" data-canvas-keyboard-scope="controls"><p role="status">{valid ? model.reason : "No valid numeric values are available for a distribution."}</p></figure>;
  const binsWithShares = model.ranges;
  const maximum = view === "count" ? Math.max(...binsWithShares.map(bin => bin.count)) : 100;
  const slot = 304 / binsWithShares.length;
  const viewLabel = view === "count" ? "unweighted response counts" : view === "percent" ? "percent of valid numeric values" : "cumulative percent of valid numeric values";
  const displayed = (bin: typeof binsWithShares[number]) => view === "count" ? bin.count : view === "percent" ? bin.percentage : bin.cumulativePercentage;
  const format = (value: number) => view === "count" ? value.toLocaleString() : `${formatPercentageSample(value)}%`;
  return <figure ref={targetRef} tabIndex={-1} className="numeric-distribution" aria-label="Numeric distribution" data-canvas-keyboard-scope="controls">
    <figcaption><strong>Distribution</strong><span>{`${valid.toLocaleString()} valid values across ${binsWithShares.length} numeric range${binsWithShares.length === 1 ? "" : "s"}. Each value belongs to one range.`}</span></figcaption>
    <label htmlFor={`${id}-view`}>Distribution view</label>
    <select ref={node => controlRef("view", node)} id={`${id}-view`} value={view} onChange={event => { const value = event.target.value; if (value === "count" || value === "percent" || value === "cumulative") setView(value); }}>
      <option value="count">Response counts</option><option value="percent">Percent of valid values</option><option value="cumulative">Cumulative percent</option>
    </select>
    <p id={`${id}-context`}>{view === "cumulative" ? "Cumulative bars include this range and all earlier ranges. The final range includes every valid value." : "Each bar describes only that numeric range."} All views are unweighted and exclude blank or invalid numeric values.</p>
    <svg viewBox="0 0 360 180" role="img" aria-label={`${label}: ${viewLabel} across ${binsWithShares.length} numeric ranges`} aria-describedby={`${id}-context`}>
      <text x="34" y="12">{view === "count" ? "Responses" : view === "percent" ? "Percent" : "Cumulative percent"}</text>
      <text x="28" y="20" textAnchor="end">{view === "count" ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(maximum) : "100%"}</text>
      <text x="28" y="148" textAnchor="end">{view === "count" ? "0" : "0%"}</text>
      <line x1="34" x2="344" y1="145" y2="145"/>
      {binsWithShares.map((bin, index) => {
        const value = displayed(bin), height = value / maximum * 120;
        return <g key={index} data-bin={index} data-count={bin.count} data-view-value={value}>
          <rect x={36 + index * slot} y={145 - height} width={Math.max(1, slot - 5)} height={height} rx="2"><title>{`${distributionRangeLabel(bin)}: ${format(value)}${view === "cumulative" ? ` through this range (${bin.cumulativeCount.toLocaleString()} of ${valid.toLocaleString()} valid values)` : ` (${bin.count.toLocaleString()} of ${valid.toLocaleString()} valid values)`}`}</title></rect>
          <text x={36 + (index + 0.5) * slot - 2} y="162" textAnchor="middle">{index + 1}</text>
        </g>;
      })}
      <text x="190" y="178" textAnchor="middle">Numeric range</text>
    </svg>
    <details><summary ref={node => controlRef("summary", node)}>See range counts</summary><p>Ranges include the lower limit. Only the last range includes its upper limit. Up to ten ranges are used; very close boundaries may be combined. Percentages use {valid.toLocaleString()} valid numeric values; cumulative percentages include all ranges through the current one. Percentages are rounded for display.</p>
      <div ref={node => controlRef("table", node)} className="numeric-distribution-table" role="region" tabIndex={0} aria-label={`${label}: range counts and percentages`}><table><caption>{label}: complete numeric range counts and shares</caption><thead><tr><th scope="col">Range</th><th scope="col">Responses</th><th scope="col">Percent of valid</th><th scope="col">Cumulative percent</th></tr></thead><tbody>{binsWithShares.map((bin, index) => <tr key={index}><th scope="row">{index + 1}: {distributionRangeLabel(bin)}</th><td>{bin.count.toLocaleString()}</td><td>{formatPercentageSample(bin.percentage)}%</td><td>{formatPercentageSample(bin.cumulativePercentage)}%</td></tr>)}</tbody></table></div>
    </details>
  </figure>;
}
