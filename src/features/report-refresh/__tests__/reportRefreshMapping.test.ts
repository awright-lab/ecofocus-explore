import { expect, it } from 'vitest';
import { fixture } from './reportRefreshFixture';
import { previewReportRefresh, createRefreshedReportWorkspace } from '../reportRefreshModel';
import { createReportRecord, normalizeDashboardWorkspace } from '../../document/workspacePersistence';
import type { WaveFieldMapping } from '../reportRefreshMapping';

async function renamed() {
 const ctx=await fixture(); const target=ctx.studies[1],field=target.fields[0];
 field.sourceColumn='Area';field.label='Area';
 target.rows=[{Area:'N',Amount:'1',Banner:'A'},{Area:'S',Amount:'2',Banner:'A'},{Area:'S',Amount:'3',Banner:'B'},{Area:'S',Amount:'4',Banner:'B'}];target.rowCount=4;target.previewRows=target.rows;
 const mappings:WaveFieldMapping[]=[{sourceFieldId:ctx.studies[0].fields[0].id,targetFieldId:field.id,categories:[{source:'North',target:'N'},{source:'South',target:'S'}]}];
 return {ctx,mappings};
}
it('maps renamed raw categories, counts real new-wave rows and preserves source, studies and history',async()=>{
 const {ctx,mappings}=await renamed(),snapshot=JSON.stringify(ctx);
 const preview=await previewReportRefresh(ctx,'new','Mapped November',{mappings});
 expect(preview.analyses[0].changes.map(cell=>[cell.before,cell.after,cell.afterBase])).toEqual([[3,1,4],[1,3,4]]);
 const workspace=normalizeDashboardWorkspace({reports:[createReportRecord(ctx.draft)],importedDatasets:ctx.studies});workspace.importedDatasets=ctx.studies;
 const before=JSON.stringify(workspace),built=createRefreshedReportWorkspace(workspace,ctx,preview,true);
 expect(JSON.stringify(ctx)).toBe(snapshot);expect(JSON.stringify(workspace)).toBe(before);
 expect(built.workspace.reports).toHaveLength(2);expect(built.workspace.reports[1]).toEqual(workspace.reports[0]);
 expect(built.report.waveRefresh?.categoryMappings).toEqual(mappings);
 expect(built.report.pages[0].tiles[0].result.table.map(row=>row.label).sort()).toEqual(['N','S']);
});
it('rejects unmapped, ambiguous and incompatible fields and categories',async()=>{
 const {ctx,mappings}=await renamed();
 await expect(previewReportRefresh(ctx,'new','Next',{mappings:[]})).rejects.toThrow('Map');
 await expect(previewReportRefresh(ctx,'new','Next',{mappings:[...mappings,...mappings]})).rejects.toThrow('duplicate');
 mappings[0].categories[1].target='N';await expect(previewReportRefresh(ctx,'new','Next',{mappings})).rejects.toThrow('one-to-one');
 ctx.studies[1].fields[0].type='numeric';await expect(previewReportRefresh(ctx,'new','Next',{mappings})).rejects.toThrow('incompatible');
});
it('rejects remote and weighted workflows',async()=>{
 const {ctx,mappings}=await renamed();ctx.studies[1].sourceType='netlify';
 await expect(previewReportRefresh(ctx,'new','Next',{mappings})).rejects.toThrow('Remote');
 ctx.studies[1].sourceType='local_file';ctx.draft.pages[0].tiles[0].query.weight='weightvar';
 await expect(previewReportRefresh(ctx,'new','Next',{mappings})).rejects.toThrow('Weighted');
});
it('validates a complete 10,000-category bijection and rejects unknown or duplicate targets',async()=>{
 const {validateWaveMapping}=await import('../reportRefreshMapping');
 const ctx=await fixture(),[source,target]=ctx.studies,oldField=source.fields[0],newField=target.fields[0];
 source.rows=Array.from({length:10000},(_,i)=>({Region:`Old ${i}`}));target.rows=Array.from({length:10000},(_,i)=>({Region:`New ${i}`}));
 const categories=source.rows.map((row,i)=>({source:row.Region,target:`New ${i}`}));
 const mappings=[{sourceFieldId:oldField.id,targetFieldId:newField.id,categories}];
 expect(validateWaveMapping(source,target,oldField,mappings).entry.categories).toHaveLength(10000);
 categories[9999].target='Unknown';expect(()=>validateWaveMapping(source,target,oldField,mappings)).toThrow('one-to-one');
 categories[9999].target='New 0';expect(()=>validateWaveMapping(source,target,oldField,mappings)).toThrow('one-to-one');
});
