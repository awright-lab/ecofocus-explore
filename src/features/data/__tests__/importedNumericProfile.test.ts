import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildImportedNumericProfile } from '../importedNumericProfile';
import { importDatasetBuffer } from '../datasetImportModel';
import { syntheticStudy } from '../../document/__tests__/fixtures/syntheticStudy';
async function study(text='Spend,Region\n10,North\n,South\ninvalid,North\n30,South\n0,North\n') {
 const result=await importDatasetBuffer(new TextEncoder().encode(text).buffer,'synthetic.csv');if(!result.dataset)throw Error(result.error);return result.dataset;
}
afterEach(()=>vi.unstubAllGlobals());
describe('complete-study numeric field profiles',()=>{
 it('separates blanks/invalid values, includes zero and computes an unweighted profile',async()=>{
  const dataset=await study(),before=structuredClone(dataset);const value=buildImportedNumericProfile(dataset,dataset.fields[0]);
  expect(value).toMatchObject({status:'ready',rows:5,valid:3,blank:1,invalid:1,distinct:3,minimum:0,maximum:30,median:10,total:40});
  if(value.status==='ready')expect(value.mean).toBeCloseTo(40/3);expect(dataset).toEqual(before);
 });
 it('calculates the even-sample median from the middle observed values',async()=>{
  const dataset=await study('Spend\n8\n2\n4\n6\n');expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({median:5,mean:5,total:20});
 });
 it('does not fabricate zero statistics when no numeric values exist',async()=>{
  const dataset=await study('Spend,Region\n,North\ninvalid,South\n');
  expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({valid:0,blank:1,invalid:1,minimum:null,maximum:null,mean:null,median:null,total:null});
 });
 it('keeps true zero means and totals distinct from unavailable statistics',async()=>{
  const dataset=await study('Spend\n-2\n0\n2\n');expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({valid:3,mean:0,median:0,total:0});
 });
 it('uses the same currency parser as analysis and rejects unsupported accounting notation and matches raw source column casing',async()=>{
  const dataset=await study('Spend\n1\n2\n3\n');dataset.rows=[{spend:'$1,200.50'},{spend:'-$200.50'},{spend:'(200.50)'},{spend:'invalid'}];dataset.rowCount=4;
  expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({valid:2,invalid:2,minimum:-200.5,maximum:1200.5,mean:500,median:500,total:1000});
 });
 it('refuses incomplete local or remote previews without any service request',async()=>{
  const dataset=await study(),fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);dataset.rows=[];dataset.previewRows=dataset.previewRows.slice(0,1);
  expect(buildImportedNumericProfile(dataset,dataset.fields[0]).status).toBe('unavailable');dataset.remote={provider:'netlify',projectUrl:'',bucket:'',objectPath:'synthetic.csv',uploadedAt:dataset.importedAt};
  expect(buildImportedNumericProfile(dataset,dataset.fields[0]).status).toBe('unavailable');expect(fetcher).not.toHaveBeenCalled();
 });
 it('can inspect an exact complete stored copy while preserving the row order',async()=>{
  const dataset=await study('Spend\n5\n1\n3\n');dataset.previewRows=structuredClone(dataset.rows);dataset.rows=[];const before=structuredClone(dataset);
  expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({valid:3,median:3,total:9});expect(dataset).toEqual(before);
 });
 it('keeps a finite extreme-value mean/median and marks overflowing totals unavailable',async()=>{
  const dataset=await study('Spend\n1\n2\n3\n4\n');dataset.rows=[{Spend:'1e308'},{Spend:'1e308'},{Spend:'-1e308'},{Spend:'-1e308'}];
  const value=buildImportedNumericProfile(dataset,dataset.fields[0]);expect(value.status).toBe('ready');if(value.status!=='ready')throw Error('profile');
  expect(value.median).toBe(0);expect(Number.isFinite(value.mean)).toBe(true);expect(value.mean!/1e308).toBeCloseTo(0);expect(value.total).toBeNull();expect(value.warnings.join()).toContain('represented safely');
 });
 it('profiles the reproducible 10000-row study with exact counts and expected statistics',async()=>{
  const {dataset}=await syntheticStudy(10000,60);expect(buildImportedNumericProfile(dataset,dataset.fields[3])).toMatchObject({valid:10000,blank:0,invalid:0,distinct:100,minimum:1,maximum:100,median:50.5,total:505000});
 });
 it('preserves identical subnormal observations in the mean and median',async()=>{
  const dataset=await study('Spend\n5e-324\n5e-324\n');expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({valid:2,mean:5e-324,median:5e-324,total:1e-323});
 });

});

describe('bounded numeric distributions',()=>{
 it('counts all valid observations once and excludes blanks/invalid entries',async()=>{
  const dataset=await study(),before=structuredClone(dataset),profile=buildImportedNumericProfile(dataset,dataset.fields[0]);if(profile.status!=='ready')throw Error('profile');
  expect(profile.distribution.reduce((sum,bin)=>sum+bin.count,0)).toBe(profile.valid);expect(profile.distribution[0].lower).toBe(0);expect(profile.distribution.at(-1)?.upper).toBe(30);expect(profile.distribution.at(-1)?.includesUpper).toBe(true);expect(dataset).toEqual(before);
 });
 it('assigns boundary values to the next range and includes the observed maximum',async()=>{
  const dataset=await study('Spend\n0\n5\n10\n');const profile=buildImportedNumericProfile(dataset,dataset.fields[0]);if(profile.status!=='ready')throw Error('profile');
  expect(profile.distribution).toEqual([{lower:0,upper:5,count:1,includesUpper:false},{lower:5,upper:10,count:2,includesUpper:true}]);
 });
 it('uses one exact range for a constant value and none for an empty numeric sample',async()=>{
  for(const text of ['Spend\n0\n0\n0\n','Spend\n5e-324\n5e-324\n']){const dataset=await study(text),profile=buildImportedNumericProfile(dataset,dataset.fields[0]);if(profile.status!=='ready')throw Error('profile');expect(profile.distribution).toHaveLength(1);expect(profile.distribution[0].count).toBe(profile.valid);expect(profile.distribution[0].lower).toBe(profile.distribution[0].upper);}
  const dataset=await study('Spend\ninvalid\n');expect(buildImportedNumericProfile(dataset,dataset.fields[0])).toMatchObject({distribution:[]});
 });
 it('keeps extreme signed and adjacent representable values in finite non-overlapping ranges',async()=>{
  for(const text of ['Spend\n-1e308\n0\n1e308\n','Spend\n1\n1.0000000000000002\n','Spend\n5e-324\n1e-323\n']){
   const dataset=await study(text),profile=buildImportedNumericProfile(dataset,dataset.fields[0]);if(profile.status!=='ready')throw Error('profile');
   expect(profile.distribution.reduce((sum,bin)=>sum+bin.count,0)).toBe(profile.valid);
   profile.distribution.forEach((bin,index)=>{expect(Number.isFinite(bin.lower)&&Number.isFinite(bin.upper)).toBe(true);expect(bin.upper).toBeGreaterThan(bin.lower);if(index)expect(bin.lower).toBe(profile.distribution[index-1].upper);});
  }
 });
 it('bounds a 10000-row distribution to ten ranges without dropping observations',async()=>{
  const {dataset}=await syntheticStudy(10000,60),profile=buildImportedNumericProfile(dataset,dataset.fields[3]);if(profile.status!=='ready')throw Error('profile');expect(profile.distribution).toHaveLength(10);expect(profile.distribution.map(bin=>bin.count)).toEqual(Array(10).fill(1000));
 });
});
