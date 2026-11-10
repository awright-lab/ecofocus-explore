export type Area = { x: number; y: number; width: number; height: number };
export class DotPlotFitError extends Error {
  constructor(readonly requiredHeight: number) {
    super('All dot-plot series and labels cannot fit readably. Enlarge the chart, reduce type sizes or use the complete table/Excel; no points were truncated.');
  }
}
export const xml = (value: unknown) => {
  const raw=String(value);
  for(const character of raw){const code=character.codePointAt(0)!;if((code<32&&![9,10,13].includes(code))||(code>=0xd800&&code<=0xdfff)||code===0xfffe||code===0xffff)throw Error('A dot-plot label contains unsupported XML characters. Review its display alias; the source was retained.');}
  return raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
};
export function solid(value: string) {
  if (value.length<=256&&(/^#(?:[a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value) || /^[a-z]+$/i.test(value) || /^rgba?\([\d.,%\s]+\)$/i.test(value))) return value;
  throw Error("Dot plots require solid colors. Review the chart palette before rendering or exporting.");
}
export function text(value: string, x: number, y: number, size: number, color: string, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" text-anchor="${anchor}" fill="${xml(solid(color))}">${xml(value)}</text>`;
}
export function wrap(value: string, characters: number, words = false): string[] {
  const source = Array.from(value), lines: string[] = [];
  if (source.length > characters * 6) throw Error("A full dot-plot label cannot fit. Enlarge the chart or shorten its display alias; no label was truncated.");
  for(let i=0;i<source.length;){
    let length=Math.min(characters,source.length-i);
    if(words&&i+length<source.length)for(let n=length-1;n>0;n--)if(/\s/u.test(source[i+n])){length=n+1;break;}
    lines.push(source.slice(i,i+length).join(''));i+=length;
  }
  if(lines.length>6)throw Error("A full dot-plot label cannot fit. Enlarge the chart or shorten its display alias; no label was truncated.");
  return lines.length ? lines : [""];
}
export function marker(index: number, x: number, y: number, fill: string, paired = false) {
  const color=xml(solid(fill));
  switch(index % 6) {
    case 1:return paired ? `<rect x="${x-6}" y="${y-6}" width="12" height="12" fill="none" stroke="${color}" stroke-width="2"/>` : `<rect x="${x-4}" y="${y-4}" width="8" height="8" fill="${color}"/>`;
    case 2:return `<polygon points="${x},${y-5} ${x+5},${y} ${x},${y+5} ${x-5},${y}" fill="${color}"/>`;
    case 3:return `<polygon points="${x},${y-5} ${x+5},${y+4} ${x-5},${y+4}" fill="${color}"/>`;
    case 4:return `<polygon points="${x-5},${y-4} ${x+5},${y-4} ${x},${y+5}" fill="${color}"/>`;
    case 5:return `<path d="M${x-5} ${y-1.5}h3.5v-3.5h3v3.5h3.5v3h-3.5v3.5h-3v-3.5h-3.5z" fill="${color}"/>`;
    default:return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;
  }
}
