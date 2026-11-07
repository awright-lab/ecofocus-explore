import type { DashboardDraft } from '../../../shared/types/dashboard';

export const imageCheckLimits = { placements: 512, uniqueImages: 64, encodedPerImage: 8 * 1024 * 1024, encodedTotal: 32 * 1024 * 1024, pixels: 16_000_000, side: 8192, timeoutMs: 5000 } as const;
export interface ImagePlacement { pageId: string; pageTitle: string; objectId?: string; name: string; source: string }
export interface ImageInventory { placements: ImagePlacement[]; overflow: boolean }
export interface ImageDimensions { width: number; height: number }
export interface ImageCheckResult extends Omit<ImagePlacement, 'source'> { ready: boolean; message: string; dimensions?: ImageDimensions }
export type ImageDecoder = (source: string, signal: AbortSignal) => Promise<ImageDimensions>;

/** Captures only visible image placements. No URL is fetched or serialized. */
export function imageInventory(dashboard: DashboardDraft): ImageInventory {
  const placements: ImagePlacement[] = [];
  for (const page of dashboard.pages) {
    if (page.backgroundMode === 'image') placements.push({ pageId: page.id, pageTitle: page.title, name: 'Page background', source: page.backgroundImage ?? '' });
    for (const element of page.elements) {
      if (!element.hidden && element.type === 'image') placements.push({ pageId: page.id, pageTitle: page.title, objectId: element.id, name: element.name, source: element.content });
      if (placements.length > imageCheckLimits.placements) return { placements: placements.slice(0, imageCheckLimits.placements), overflow: true };
    }
    if (placements.length > imageCheckLimits.placements) return { placements: placements.slice(0, imageCheckLimits.placements), overflow: true };
  }
  return { placements, overflow: false };
}
export function sameImageInventory(a: ImageInventory, b: ImageInventory) {
  return !a.overflow && !b.overflow && a.placements.length === b.placements.length && a.placements.every((item, index) => {
    const other = b.placements[index];
    return item.pageId === other.pageId && item.pageTitle === other.pageTitle && item.objectId === other.objectId && item.name === other.name && item.source === other.source;
  });
}
const abort = () => new DOMException('Image checking canceled.', 'AbortError');
function dimensionsAllowed({width,height}: ImageDimensions) {
  if (![width,height].every(value => Number.isSafeInteger(value) && value > 0 && value <= imageCheckLimits.side) || width * height > imageCheckLimits.pixels) throw Error('Image dimensions exceed this bounded check (8,192 per side; 16 million pixels), or are invalid.');
}

/** Reads at most64KiB of header before allowing the browser decoder to allocate pixels. */
export function embeddedImageDimensions(source: string): ImageDimensions & { format: string } {
  if (source.length > imageCheckLimits.encodedPerImage) throw Error('Embedded image exceeds the 8 Mi-character check limit.');
  const prefix = /^data:image\/(png|jpeg|webp);base64,/i.exec(source);
  if (!prefix) throw Error('Use an embedded PNG, JPEG or static WebP image. External, SVG and missing images are not fetched by this check.');
  const body = source.slice(prefix[0].length);
  if (!body || body.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body)) throw Error('Embedded image has invalid base64 data.');
  let binary: string;
  try { binary = atob(body.slice(0, 87380)); } catch { throw Error('Embedded image has invalid base64 data.'); }
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)), format = prefix[1].toLowerCase();
  const be16 = (i: number) => bytes[i] * 256 + bytes[i+1];
  const be32 = (i: number) => bytes[i] * 16777216 + bytes[i+1] * 65536 + bytes[i+2] * 256 + bytes[i+3];
  const le24 = (i: number) => bytes[i] + bytes[i+1] * 256 + bytes[i+2] * 65536;
  const text = (i: number, n: number) => String.fromCharCode(...bytes.slice(i,i+n));
  let dimensions: ImageDimensions | undefined;
  if (format === 'png' && bytes.length >= 33 && bytes.slice(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index]) && be32(8)===13 && text(12,4)==='IHDR') {
    let offset=33,staticHeader=false;
    while(offset+8<=bytes.length){
      const length=be32(offset),chunk=text(offset+4,4);
      if(chunk==='acTL')throw Error('Animated PNG is not verified by this static export check. Use a static image.');
      if(chunk==='IDAT'){staticHeader=true;break;}
      if(chunk==='IEND'||offset+length+12>bytes.length)break;
      offset+=length+12;
    }
    if(!staticHeader)throw Error('PNG static-image header could not be verified within64 KiB. Re-embed a supported static image.');
    dimensions={width:be32(16),height:be32(20)};
  }
  if (format === 'jpeg' && bytes[0]===255 && bytes[1]===216) {
    let offset=2;
    while(offset+3<bytes.length){
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      const length=be16(offset);if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8){dimensions={height:be16(offset+3),width:be16(offset+5)};break;}
      offset+=length;
    }
  }
  if(format==='webp'&&bytes.length>=30&&text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
    const chunk=text(12,4);
    if(chunk==='VP8X'){
      if(bytes[20]&2)throw Error('Animated WebP is not verified by this static export check. Use a static image.');
      dimensions={width:1+le24(24),height:1+le24(27)};
    } else if(chunk==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)dimensions={width:(bytes[26]+bytes[27]*256)&0x3fff,height:(bytes[28]+bytes[29]*256)&0x3fff};
    else if(chunk==='VP8L'&&bytes[20]===0x2f)dimensions={width:1+((bytes[21]+bytes[22]*256)&0x3fff),height:1+(((bytes[22]>>6)+bytes[23]*4+bytes[24]*1024)&0x3fff)};
  }
  if(!dimensions)throw Error('Image dimensions could not be verified in the bounded PNG/JPEG/WebP header check. Re-embed a supported static image.');
  dimensionsAllowed(dimensions);return {...dimensions,format};
}

export const decodeEmbeddedImage: ImageDecoder = (source,signal) => new Promise((resolve,reject)=>{
  if(signal.aborted){reject(abort());return;}
  if(typeof Image==='undefined'){reject(Error('This browser image decoder is unavailable.'));return;}
  const image=new Image();let settled=false;
  const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',cancel);image.onload=null;image.onerror=null;const dimensions={width:image.naturalWidth,height:image.naturalHeight};image.removeAttribute('src');if(error)reject(error);else resolve(dimensions);};
  const cancel=()=>finish(abort()),timer=setTimeout(()=>finish(Error('Image decoding timed out; readiness is unverified.')),imageCheckLimits.timeoutMs);
  image.onload=()=>{
    if(typeof image.decode!=='function'){finish(Error('This browser cannot confirm image decoding.'));return;}
    try{image.decode().then(()=>finish(),()=>finish(Error('Embedded image could not be decoded.')));}catch{finish(Error('Embedded image could not be decoded.'));}
  };
  image.onerror=()=>finish(Error('Embedded image could not be loaded or decoded.'));
  signal.addEventListener('abort',cancel,{once:true});try{image.src=source;}catch{finish(Error('Embedded image could not be loaded or decoded.'));}
});

/** Serial decoding, exact-source deduplication, no external fetch, no report writes. */
export async function checkEmbeddedImages(inventory: ImageInventory, options: {signal: AbortSignal; onProgress?: (done:number,total:number)=>void; decode?:ImageDecoder}): Promise<ImageCheckResult[]> {
  if(options.signal.aborted)throw abort();
  if(inventory.overflow||inventory.placements.length>imageCheckLimits.placements)throw Error('Too many image placements for this bounded check (maximum512). Check a smaller report.');
  const unique=new Set<string>();let total=0;
  for(const item of inventory.placements){
    if(typeof item.source!=='string'||item.source.length>imageCheckLimits.encodedPerImage)throw Error('Embedded image exceeds the 8 Mi-character check limit or has invalid content. Readiness was not verified.');
    if(!unique.has(item.source)){unique.add(item.source);total+=item.source.length;}
    if(unique.size>imageCheckLimits.uniqueImages||total>imageCheckLimits.encodedTotal)throw Error('This check supports at most64 distinct images and32 Mi-characters of encoded content. Readiness was not verified.');
  }
  const sources=[...unique];
  const checked=new Map<string,{ready:boolean;message:string;dimensions?:ImageDimensions}>();
  options.onProgress?.(0,sources.length);
  for(const source of sources){
    if(options.signal.aborted)throw abort();
    try{
      const declared=embeddedImageDimensions(source),decoded=await(options.decode??decodeEmbeddedImage)(source,options.signal);
      if(options.signal.aborted)throw abort();
      dimensionsAllowed(decoded);
      if(!(decoded.width===declared.width&&decoded.height===declared.height)&&!(declared.format==='jpeg'&&decoded.width===declared.height&&decoded.height===declared.width))throw Error('Decoded dimensions differ from the verified image header. Readiness is unverified.');
      checked.set(source,{ready:true,message:`Decoded ${decoded.width.toLocaleString()} × ${decoded.height.toLocaleString()} pixels.`,dimensions:decoded});
    }catch(error){if(options.signal.aborted)throw abort();checked.set(source,{ready:false,message:error instanceof Error?error.message:'Image readiness could not be verified.'});}
    options.onProgress?.(checked.size,sources.length);
  }
  return inventory.placements.map(({source,...placement})=>({...placement,...checked.get(source)!}));
}
