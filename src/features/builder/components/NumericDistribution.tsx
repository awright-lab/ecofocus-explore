import type { NumericDistributionBin } from "../../data/importedNumericProfile";

function rangeLabel(bin: NumericDistributionBin) {
  if (bin.lower === bin.upper) return `All values equal ${bin.lower}`;
  return `${bin.lower} to ${bin.includesUpper ? "" : "less than "}${bin.upper}${bin.includesUpper ? " (inclusive)" : ""}`;
}

export function NumericDistribution({ bins, valid, label }: { bins: NumericDistributionBin[]; valid: number; label: string }) {
  if (!bins.length || !valid) return null;
  const maximum = Math.max(...bins.map(bin => bin.count));
  const slot = 304 / bins.length;
  return <figure className="numeric-distribution">
    <figcaption><strong>Distribution</strong><span>{`${valid.toLocaleString()} valid values across ${bins.length} numeric range${bins.length === 1 ? "" : "s"}. Each value is counted once.`}</span></figcaption>
    <svg viewBox="0 0 360 180" role="img" aria-label={`${label}: unweighted response counts across ${bins.length} numeric ranges`}>
      <text x="34" y="12">Responses</text>
      <text x="28" y="20" textAnchor="end">{new Intl.NumberFormat("en-US",{notation:"compact",maximumFractionDigits:1}).format(maximum)}</text>
      <text x="28" y="148" textAnchor="end">0</text>
      <line x1="34" x2="344" y1="145" y2="145"/>
      {bins.map((bin,index)=>{
        const height=bin.count / maximum * 120;
        return <g key={index} data-bin={index} data-count={bin.count}>
          <rect x={36+index*slot} y={145-height} width={Math.max(1,slot-5)} height={height} rx="2"><title>{`${rangeLabel(bin)}: ${bin.count.toLocaleString()} responses`}</title></rect>
          <text x={36+(index+0.5)*slot-2} y="162" textAnchor="middle">{index+1}</text>
        </g>;
      })}
      <text x="190" y="178" textAnchor="middle">Numeric range</text>
    </svg>
    <details><summary>See range counts</summary><p>Ranges include the lower limit. Only the last range includes its upper limit. Up to ten ranges are used; very close boundaries may be combined.</p>
      <table><thead><tr><th scope="col">Range</th><th scope="col">Responses</th></tr></thead><tbody>{bins.map((bin,index)=><tr key={index}><th scope="row">{index+1}: {rangeLabel(bin)}</th><td>{bin.count.toLocaleString()}</td></tr>)}</tbody></table>
    </details>
  </figure>;
}
