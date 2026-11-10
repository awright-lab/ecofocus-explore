import { expect,it } from 'vitest';
import { buildRankedFindings, type FindingDisplayOptions } from '../rankedFindingsModel';
import { findingsFixture } from './rankedFindingsFixture';
const options:FindingDisplayOptions={minimumDifference:5,minimumBase:30,priorityCodes:[],alpha:.05};

it('ranks actual reviewed differences with full-family probabilities, clear omissions and no mutations',async()=>{
 const {ctx,result}=await findingsFixture(),before=structuredClone({ctx,groups:result.groups,comparisons:result.comparisons});
 const feed=buildRankedFindings(result,options);
 expect(feed.ranked.map(f=>f.code)).toEqual(['A','B']);expect(feed.familySize).toBe(3);expect(feed.omitted).toEqual([{code:'Small',label:'Small',reason:expect.stringContaining('minimum valid base')}]);
 expect(feed.ranked[0]).toMatchObject({event:80,base:100,referenceEvent:50,referenceBase:100,difference:30});
 expect(feed.ranked[0].adjustedLogP).toBe(result.comparisons[0].adjustedLogP);
 expect({ctx,groups:result.groups,comparisons:result.comparisons}).toEqual(before);
});
it('uses research priority within evidence tiers without retesting or changing the family',async()=>{
 const {result}=await findingsFixture();const original=result.comparisons.map(c=>c.adjustedLogP);
 const feed=buildRankedFindings(result,{...options,priorityCodes:['B']});
 expect(feed.ranked.map(f=>f.code)).toEqual(['B','A']);expect(feed.ranked[0].priority).toBe(true);
 expect(result.comparisons.map(c=>c.adjustedLogP)).toEqual(original);expect(feed.familySize).toBe(3);
});
it('keeps adjusted evidence categories ahead of priority even for a personally prioritized group',async()=>{
 const {result}=await findingsFixture([{code:'Ref',events:50,others:50},{code:'A',events:85,others:15},{code:'B',events:52,others:48}]);
 const feed=buildRankedFindings(result,{...options,minimumDifference:0,priorityCodes:['B']});
 expect(feed.ranked.map(f=>f.code)).toEqual(['A','B']);expect(feed.ranked.map(f=>f.decision)).toEqual(['below','above']);
});
it.each([['higher',25,30],['lower',30,25]]as const)('includes an exact absolute ten-point %s boundary',async(_name,ref,event)=>{
 const {result}=await findingsFixture([{code:'Ref',events:ref,others:50-ref},{code:'A',events:event,others:50-event}]);
 expect(buildRankedFindings(result,{...options,minimumDifference:10}).ranked).toHaveLength(1);
 expect(buildRankedFindings(result,{...options,minimumDifference:11}).omitted[0].reason).toContain('minimum absolute difference');
});
it('uses unrounded differences rather than display rounding for filtering',async()=>{
 const {result}=await findingsFixture([{code:'Ref',events:50,others:50},{code:'A',events:602,others:402}]);
 expect(buildRankedFindings(result,{...options,minimumDifference:10}).ranked).toHaveLength(0);
 const finding=buildRankedFindings(result,{...options,minimumDifference:9}).ranked[0];
 expect(finding.difference).toBeCloseTo(9.960159,5);expect(finding.difference.toFixed(1)).toBe('10.0');
});
it('honors the exact base boundary and retains small-base/sparse cautions when explicitly included',async()=>{
 const {result}=await findingsFixture([{code:'Ref',events:50,others:50},{code:'A',events:29,others:0},{code:'B',events:30,others:0}]);
 expect(buildRankedFindings(result,options).ranked.map(f=>f.code)).toEqual(['B']);
 const all=buildRankedFindings(result,{...options,minimumBase:1});expect(all.ranked).toHaveLength(2);expect(all.ranked.find(f=>f.code==='A')!.cautions.join(' ')).toContain('fewer than 30');
});
it('breaks equal effects by minimum valid base, then missing/excluded share, then original order',async()=>{
 const {result}=await findingsFixture([{code:'Ref',events:50,others:50},{code:'A',events:45,others:5,missing:50},{code:'B',events:45,others:5},{code:'C',events:90,others:10},{code:'D',events:45,others:5,excluded:50}]);
 expect(buildRankedFindings(result,{...options,minimumDifference:0}).ranked.map(f=>f.code)).toEqual(['C','B','A','D']);
});
it('never gives empty or no-variation comparisons an evidence rank and retains all family positions',async()=>{
 const {result}=await findingsFixture([{code:'Ref',events:40,others:0},{code:'A',events:40,others:0},{code:'Empty',events:0,others:0}]);
 const feed=buildRankedFindings(result,{...options,minimumDifference:0,minimumBase:1});expect(feed.ranked).toEqual([]);expect(feed.omitted.map(item=>item.reason)).toEqual([expect.stringContaining('No outcome variation'),expect.stringContaining('No valid outcomes')]);expect(feed.familySize).toBe(2);
});
it('keeps prototype-like codes and duplicate display labels separate',async()=>{
 const {result}=await findingsFixture([{code:'Ref',events:50,others:50},{code:'__proto__',label:'Same',events:80,others:20},{code:'constructor',label:'Same',events:70,others:30}]);
 expect(buildRankedFindings(result,{...options,priorityCodes:['constructor']}).ranked.map(f=>f.code)).toEqual(['constructor','__proto__']);
});
it.each(['base','rows','table','adjustment','decision','family']as const)('refuses inconsistent %s evidence',async change=>{
 const {result}=await findingsFixture();
 if(change==='base')result.groups[1].base++;
 if(change==='rows')result.groups[1].rows++;
 if(change==='table')result.comparisons[0].table[0]++;
 if(change==='adjustment')result.comparisons[0].adjustedLogP=0;
 if(change==='decision')result.comparisons[0].decision='unavailable';
 if(change==='family')result.familySize++;
 expect(()=>buildRankedFindings(result,options)).toThrow();
});
it.each([{minimumDifference:-1},{minimumDifference:1.5},{minimumDifference:101},{minimumBase:0},{minimumBase:50001},{priorityCodes:['missing']},{priorityCodes:['A','A']},{alpha:0}])('rejects invalid display options %j',async change=>{
 const {result}=await findingsFixture();expect(()=>buildRankedFindings(result,{...options,...change})).toThrow();
});
it.each(['comparison first','comparison last','comparison all','group first','group last','table first','table last','table all','warning','priority','inherited comparison','inherited table','inherited warning','huge warning','extra warning properties'] as const)('refuses sparse %s arrays without changing the supplied evidence',async variant=>{
 const {result}=await findingsFixture(),display={...options,priorityCodes:[] as string[]};
 if(variant==='comparison first')delete result.comparisons[0];
 if(variant==='comparison last')delete result.comparisons[result.comparisons.length-1];
 if(variant==='comparison all')result.comparisons=new Array(result.familySize);
 if(variant==='group first')delete result.groups[0];
 if(variant==='group last')delete result.groups[result.groups.length-1];
 if(variant==='table first')Reflect.deleteProperty(result.comparisons[0].table,0);
 if(variant==='table last')Reflect.deleteProperty(result.comparisons[0].table,3);
 if(variant==='table all')result.comparisons[0].table=new Array(4) as typeof result.comparisons[0]['table'];
 if(variant==='warning')result.comparisons[0].warnings=new Array(1);
 if(variant==='priority')display.priorityCodes=new Array(1);
 if(variant.startsWith('inherited')){
  const array=variant==='inherited comparison'?result.comparisons:variant==='inherited table'?result.comparisons[0].table:result.comparisons[0].warnings;
  if(!array.length)array.push('Synthetic caution' as never);
  const inherited=Object.create(Array.prototype);inherited[0]=array[0];Reflect.deleteProperty(array,0);Object.setPrototypeOf(array,inherited);
 }
 if(variant==='huge warning')result.comparisons[0].warnings=new Array(1_000_000_000);
 if(variant==='extra warning properties'){const warnings=new Array(1);Object.assign(warnings,{extra:'Not a position',other:'Still not a position'});result.comparisons[0].warnings=warnings;}
 if(variant==='huge warning'){const warnings=result.comparisons[0].warnings;expect(()=>buildRankedFindings(result,display)).toThrow();expect(result.comparisons[0].warnings).toBe(warnings);expect(Object.getOwnPropertyNames(warnings)).toEqual(['length']);expect(warnings.length).toBe(1_000_000_000);return;}
 const before=JSON.stringify({groups:result.groups,comparisons:result.comparisons,priorities:display.priorityCodes});
 expect(()=>buildRankedFindings(result,display)).toThrow();
 expect(JSON.stringify({groups:result.groups,comparisons:result.comparisons,priorities:display.priorityCodes})).toBe(before);
});
it('accepts present own nonenumerable table positions rather than treating enumerability as density',async()=>{const {result}=await findingsFixture();Object.defineProperty(result.comparisons[0].table,0,{value:80,enumerable:false});expect(buildRankedFindings(result,options).ranked.map(finding=>finding.code)).toEqual(['A','B']);});
