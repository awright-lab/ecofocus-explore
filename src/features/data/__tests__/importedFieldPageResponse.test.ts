import {afterEach,expect,it,vi} from 'vitest';
import {listImportedDatasetFieldsFromNetlify} from '../netlifyDatasetStore';
afterEach(()=>vi.unstubAllGlobals());
function fixture(){return {datasetId:'known-study',offset:0,limit:120,total:1,fields:[{id:'answer_1',label:'Answer',sourceColumn:'Answer',type:'categorical',nonEmptyCount:1,distinctCount:1,sampleValues:['Yes'],modelingRole:'candidate_dimension',eligibleForFilter:true,eligibleForSegment:true,eligibleForBanner:true}]};}
it.each(['wrong study','wrong page','duplicate field','missing fields','negative total','malformed field'])('rejects %s before field metadata reaches the UI',async problem=>{
 const result:Record<string,unknown>=fixture();
 if(problem==='wrong study')result.datasetId='another-study';
 if(problem==='wrong page')result.offset=120;
 if(problem==='duplicate field'){result.fields=[fixture().fields[0],fixture().fields[0]];result.total=2;}
 if(problem==='missing fields')delete result.fields;
 if(problem==='negative total')result.total=-1;
 if(problem==='malformed field')result.fields=[{id:'bad'}];
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>result}));
 await expect(listImportedDatasetFieldsFromNetlify({datasetId:'known-study',offset:0,limit:120})).rejects.toThrow();
});
it('accepts the current valid service shape',async()=>{
 const result=fixture();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>result}));
 expect(await listImportedDatasetFieldsFromNetlify({datasetId:'known-study',offset:0,limit:120})).toEqual(result);
});

it.each(['wrong limit','incomplete page','invalid field type','invalid role','negative count','inconsistent distinct count','non-string sample','invalid labels','missing flag'])('rejects inconsistent metadata: %s',async problem=>{
 const result=fixture();const field=result.fields[0] as Record<string,unknown>;
 if(problem==='wrong limit')result.limit=119;
 if(problem==='incomplete page')result.total=2;
 if(problem==='invalid field type')field.type='invented';
 if(problem==='invalid role')field.modelingRole='invented';
 if(problem==='negative count')field.nonEmptyCount=-1;
 if(problem==='inconsistent distinct count')field.distinctCount=2;
 if(problem==='non-string sample')field.sampleValues=[123];
 if(problem==='invalid labels')field.valueLabels={one:123};
 if(problem==='missing flag')delete field.eligibleForBanner;
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>result}));
 await expect(listImportedDatasetFieldsFromNetlify({datasetId:'known-study',offset:0,limit:120})).rejects.toThrow('metadata was incomplete');
});
it.each([{offset:-1},{offset:0.5},{offset:100001},{limit:0},{limit:501},{datasetId:''}])('rejects invalid page request before fetching: %j',async invalid=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(listImportedDatasetFieldsFromNetlify({datasetId:'known-study',offset:0,limit:120,...invalid})).rejects.toThrow('request is invalid');expect(fetcher).not.toHaveBeenCalled();
});
it('accepts an empty filtered list or a page beyond its end without inventing fields',async()=>{
 for(const offset of [0,120]){
  const result={...fixture(),total:0,fields:[],offset};vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>result}));
  expect(await listImportedDatasetFieldsFromNetlify({datasetId:'known-study',offset,limit:120})).toEqual(result);
 }
});
it('handles malformed server error details without a type error',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:'Fields unavailable',details:'not an array'})}));
 await expect(listImportedDatasetFieldsFromNetlify({datasetId:'known-study',offset:0,limit:120})).rejects.toThrow('Fields unavailable');
});
