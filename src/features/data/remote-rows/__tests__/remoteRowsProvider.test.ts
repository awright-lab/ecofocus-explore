import { describe, expect, it } from 'vitest';
import { remoteRowsLimits as limits, validateRows, validateSchema, type Request, type Source } from '../remoteRowsProvider';
import { syntheticRemoteRows } from '../syntheticRemoteRows';
const source: Source = { datasetId:'constructor', datasetRevision:'r1', schemaRevision:'σ' };
const request: Request = { source, cursor:null, limit:25, maxBytes:limits.bytes, signal:new AbortController().signal };
const rows = { ...request, columns:['__proto__','a'] };
describe('remote page boundary', () => {
  it('keeps missing, empty, null and zero distinct with reserved IDs', () => {
    const values = Object.assign(Object.create(null), { '__proto__':'', a:0 });
    Object.defineProperty(values, '__proto__', { value:'', enumerable:true });
    const page = validateRows({source,columns:rows.columns,cursor:null,nextCursor:'opaque',items:[{position:'1',values},{position:'2',values:{a:null}},{position:'3',values:{}}]},rows);
    expect(Object.hasOwn(page.items[0].values,'__proto__')).toBe(true); expect(page.items[0].values['__proto__']).toBe(''); expect(page.items[0].values.a).toBe(0); expect(page.items[1].values.a).toBeNull(); expect(Object.hasOwn(page.items[2].values,'a')).toBe(false);
  });
  it.each([
    ['revision', {source:{...source,datasetRevision:'old'},cursor:null,nextCursor:null,items:[]}],
    ['cursor', {source,cursor:'other',nextCursor:null,items:[]}],
    ['repeated cursor', {source,cursor:null,nextCursor:42,items:[]}],
    ['unexpected column', {source,cursor:null,nextCursor:null,items:[{position:'1',values:{other:0}}]}],
    ['nonfinite', {source,cursor:null,nextCursor:null,items:[{position:'1',values:{a:Infinity}}]}],
    ['oversized', {source,cursor:null,nextCursor:null,items:[{position:'1',values:{a:'x'.repeat(limits.bytes)}}]}],
    ['duplicate positions', {source,cursor:null,nextCursor:null,items:[{position:'1',values:{}},{position:'1',values:{}}]}],
  ])('rejects %s', (_label,payload) => expect(() => validateRows({...payload,columns:rows.columns},rows)).toThrow());
  it('checks normalized bytes even if a provider customizes JSON serialization', () => { const payload = {source,columns:rows.columns,cursor:null,nextCursor:null,items:Array.from({length:25},(_,i)=>({position:String(i),values:{a:'x'.repeat(8192)}})), toJSON:()=>({})}; expect(() => validateRows(payload,rows)).toThrow('size'); });
  it('rejects a row page for a different requested column order', () => { expect(() => validateRows({source,columns:['a','__proto__'],cursor:null,nextCursor:null,items:[]}, rows)).toThrow('columns'); });
  it('rejects duplicate field identities and excess fields', () => {
    const field={id:'x',label:'same',sourceColumn:'x'}; expect(() => validateSchema({source,cursor:null,nextCursor:null,items:[field,field]},request)).toThrow();
    expect(() => validateSchema({source,cursor:null,nextCursor:null,items:Array.from({length:26},(_,i)=>({...field,id:String(i)}))},request)).toThrow();
  });
  it('generates only requested synthetic slices and honors aborts', async () => {
    const {provider,stats}=syntheticRemoteRows(source); const s=validateSchema(await provider.schema({...request,limit:40}),{...request,limit:40});
    const page=validateRows(await provider.rows({...request,columns:[s.items[0].id]}),{...request,columns:[s.items[0].id]}); expect(page.items).toHaveLength(25); expect(stats.maxRowsGenerated).toBe(25); expect(stats.maxFieldsGenerated).toBe(40);
    const ac=new AbortController(); ac.abort(); await expect(provider.schema({...request,signal:ac.signal})).rejects.toThrow();
  });
});
