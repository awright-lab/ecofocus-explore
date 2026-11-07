import {expect,it} from 'vitest';
import {importDatasetBuffer} from '../datasetImportModel';
import {importedFieldValues,runImportedDatasetQuery} from '../importedDatasetAnalytics';
import {audienceCategoryChoices,audienceCategoryKey,previewAudience} from '../../audiences/audienceModel';
import {importedCategoryCode} from '../importedCategoryCode';
import {buildImportedCategoricalProfile,buildCategoricalProfileFromValues} from '../importedCategoricalProfile';
import {categoryAliasOracle} from './categoryAliasOracle';
async function fixture(){const{dataset}=await importDatasetBuffer(new TextEncoder().encode('Code\n1e-9999\n0\n2\n').buffer,'synthetic-alias.csv');const d=dataset!;d.fields[0]={...d.fields[0],type:'categorical',modelingRole:'candidate_dimension',valueLabels:{'0':'Observed zero'}};return d;}
it('does not merge an under-range categorical code into a labeled observed zero',async()=>{const d=await fixture(),before=structuredClone(d),result=runImportedDatasetQuery({dataset:d,field:d.fields[0],metric:'count',chartType:'table'});expect(result.table.find(row=>row.label==='Observed zero')!.values.summary).toBe(1);expect(result.table.find(row=>row.label==='1e-9999')?.values.summary).toBe(1);expect(d).toEqual(before);});
it('does not select an under-range code through a zero-category audience alias',async()=>{const d=await fixture(),f=d.fields[0],a={version:1 as const,id:'zeros',label:'Observed zero only',datasetId:d.id,importedAt:d.importedAt,expression:{kind:'category' as const,fieldId:f.id,sourceColumn:'Code',values:['0'],exclude:false}};expect(previewAudience(a,d)).toEqual({included:1,excluded:2,unknown:0,total:3});});
it.each(categoryAliasOracle.vectors)('matches exact decimal alias reference for $raw and label $labelKey',async vector=>{
 const d=await fixture(),f={...d.fields[0],valueLabels:{[vector.labelKey]:'Recorded category'}};
 const labelsBefore=structuredClone(f.valueLabels);expect(importedCategoryCode(f,vector.raw)).toBe(vector.expected);expect(audienceCategoryKey(f,vector.raw)).toBe(vector.expected);expect(f.valueLabels).toEqual(labelsBefore);
});
it('gives an exact own label key precedence over its numeric-looking alias',async()=>{
 const d=await fixture(),f={...d.fields[0],valueLabels:{'01':'Own zero-one','1':'One','1e-9999':'Tiny code','0':'Zero'}};
 for(const raw of ['01','1','1e-9999','0'])expect(importedCategoryCode(f,raw)).toBe(raw);
});
it('keeps prototype-like raw codes literal and does not read inherited labels',async()=>{
 const d=await fixture(),f={...d.fields[0],valueLabels:Object.create({'0':'Inherited zero','constructor':'Inherited constructor'}) as Record<string,string>};
 for(const raw of ['__proto__','constructor','toString','1e-9999','-0'])expect(importedCategoryCode(f,raw)).toBe(raw);
 f.valueLabels=JSON.parse('{"__proto__":"Explicit proto code","constructor":"Explicit constructor code"}');
 expect(importedCategoryCode(f,'__proto__')).toBe('__proto__');expect(importedCategoryCode(f,'constructor')).toBe('constructor');
});
it('preserves the existing blank convention and trims source whitespace only',async()=>{
 const d=await fixture(),f=d.fields[0];for(const raw of ['', ' \t\r\n',undefined])expect(importedCategoryCode(f,raw)).toBeNull();expect(audienceCategoryKey(f,' \t')).toBe('');expect(importedCategoryCode(f,' literal code ')).toBe('literal code');
});
it('bounds exponent handling without expanding huge exponents or rounding a nonzero coefficient into zero',async()=>{
 const d=await fixture(),f=d.fields[0],exponent='9'.repeat(1000);expect(importedCategoryCode(f,`0e${exponent}`)).toBe('0');expect(importedCategoryCode(f,`1e-${exponent}`)).toBe(`1e-${exponent}`);
 expect(importedCategoryCode(f,`0.${'0'.repeat(1000)}1`)).toBe(`0.${'0'.repeat(1000)}1`);
});
it('keeps grouping, breakout, filter choices, profile and audience membership consistent without changing rows or labels',async()=>{
 const d=await fixture(),f=d.fields[0];d.rows=[{Code:'1e-9999'},{Code:'0'},{Code:'-0'},{Code:'0.0'},{Code:'2'},{Code:''}];d.rowCount=d.rows.length;const banner={...f,id:'mirror',sourceColumn:'Mirror',label:'Mirror'};d.fields.push(banner);d.fieldCount=2;for(const row of d.rows)row.Mirror=row.Code;const before=structuredClone(d);
 expect(importedFieldValues(d,f)).toEqual(expect.arrayContaining(['Observed zero','1e-9999','2']));
 expect(audienceCategoryChoices(d,f)).toEqual(expect.arrayContaining([{value:'0',label:'Observed zero [0]'},{value:'1e-9999',label:'1e-9999'},{value:'2',label:'2'}]));
 const profile=buildImportedCategoricalProfile(d,f);expect(profile).toMatchObject({status:'ready',valid:5,blank:1,observedCategories:3});if(profile.status!=='ready')throw Error('profile');expect(profile.categories.map(c=>[c.label,c.count])).toEqual([['Observed zero',3],['1e-9999',1],['2',1]]);expect(buildCategoricalProfileFromValues(d.rows.map(row=>row.Code),f)).toEqual(profile);
 const filtered=runImportedDatasetQuery({dataset:d,field:f,filter:{field:f,value:'Observed zero'},metric:'count',chartType:'table'});expect(filtered.table.find(row=>row.label==='Observed zero')!.values.summary).toBe(3);expect(filtered.table.reduce((n,row)=>n+row.values.summary,0)).toBe(3);
 const split=runImportedDatasetQuery({dataset:d,field:f,bannerField:banner,metric:'count',chartType:'table'}),zeroColumn=split.columns.find(c=>c.label==='Observed zero')!.id,tinyColumn=split.columns.find(c=>c.label==='1e-9999')!.id;
 expect(split.table.find(row=>row.label==='Observed zero')!.values[zeroColumn]).toBe(3);expect(split.table.find(row=>row.label==='1e-9999')!.values[tinyColumn]).toBe(1);expect(split.table.find(row=>row.label==='Observed zero')!.values[tinyColumn]).toBe(0);
 const a={version:1 as const,id:'zeros',label:'Only observed zeros',datasetId:d.id,importedAt:d.importedAt,expression:{kind:'category' as const,fieldId:f.id,sourceColumn:'Code',values:['0'],exclude:false}};expect(previewAudience(a,d)).toEqual({included:3,excluded:2,unknown:1,total:6});expect(previewAudience({...a,expression:{...a.expression,exclude:true}},d)).toEqual({included:2,excluded:3,unknown:1,total:6});
 const result=runImportedDatasetQuery({dataset:d,field:f,audience:a,metric:'count',chartType:'table'});expect(result.table.find(row=>row.label==='Observed zero')!.values.summary).toBe(3);expect(d).toEqual(before);
});
it('keeps ordinary exact decimal aliases aggregated under their recorded label',async()=>{
 const d=await fixture(),f={...d.fields[0],valueLabels:{'1':'One'}};d.fields=[f];d.rows=['01','1.0','1e0','1','1.0000000000000001'].map(Code=>({Code}));d.rowCount=5;const before=structuredClone(d),r=runImportedDatasetQuery({dataset:d,field:f,metric:'count',chartType:'table'});expect(r.table.find(row=>row.label==='One')!.values.summary).toBe(4);expect(r.table.find(row=>row.label==='1.0000000000000001')!.values.summary).toBe(1);expect(d).toEqual(before);
});
