import {expect,it} from 'vitest';
import {buildNumericProfileFromValues} from '../importedNumericProfile';
import {profileOverflowOracle} from './profileOverflowOracle';
it('recovers the verified mean without the old huge cancellation estimate',()=>{const reference=profileOverflowOracle.cases[0],values=[...reference.values],before=[...values],profile=buildNumericProfileFromValues(values);expect(reference.referenceMean).toBe(.2);expect(profile).toMatchObject({valid:5,total:null,mean:.2,median:1});expect(values).toEqual(before);});
it.each(profileOverflowOracle.cases)('recovers representable means against exact binary64-input reference: $label',reference=>{
 const values=[...reference.values],before=[...values],profile=buildNumericProfileFromValues(values);
 expect(profile.status).toBe('ready');if(profile.status!=='ready')throw Error('profile');
 expect(profile.mean).toBe(reference.referenceMean === 0 && reference.exactMeanNumerator !== "0" ? null : reference.referenceMean);expect(profile.valid).toBe(values.length);expect(profile.blank).toBe(0);expect(profile.invalid).toBe(0);
 expect(profile.distribution.reduce((n,bin)=>n+bin.count,0)).toBe(values.length);expect(values).toEqual(before);
 if(profile.mean!==null)expect(profile.mean).toBe(reference.referenceMean);
 if(profile.mean===null)expect(profile.warnings.join(' ')).toContain('below the supported numeric range');
});
function permutations(values:readonly string[]):string[][]{
 if(!values.length)return[[]];const result:string[][]=[];
 for(const value of new Set(values)){const rest=[...values];rest.splice(rest.indexOf(value),1);for(const suffix of permutations(rest))result.push([value,...suffix]);}
 return result;
}
const orders=permutations(profileOverflowOracle.cases[0].values);
it('covers all 30 distinct source orders of the reported cancellation',()=>expect(orders).toHaveLength(30));
it.each(orders.map((values,index)=>({values,index})))('returns the correct recovered mean in source order $index',({values})=>{
 const before=[...values],profile=buildNumericProfileFromValues(values);if(profile.status!=='ready')throw Error('profile');
 expect(profile.mean).toBe(.2);expect(profile).toMatchObject({valid:5,invalid:0,blank:0,minimum:-1e308,maximum:1e308,median:1});
 expect(profile.distribution.reduce((n,bin)=>n+bin.count,0)).toBe(5);expect(values).toEqual(before);
 if(profile.total!==null)expect(profile).toMatchObject({total:1,mean:.2});else expect(profile.mean).toBe(.2);
});
it.each(['1.7976931348623157e308','-1.7976931348623157e308'])('retains the proved mean for identical extreme %s observations',value=>expect(buildNumericProfileFromValues([value,value,value])).toMatchObject({valid:3,total:null,mean:Number(value),median:Number(value)}));
it('preserves exclusions and all source strings while recovering the mean',()=>{
 const values=['-1e308','','-1e308','not a number','1','1e308','1e308'],before=[...values],profile=buildNumericProfileFromValues(values);
 expect(profile).toMatchObject({rows:7,valid:5,blank:1,invalid:1,total:null,mean:.2,median:1});expect(values).toEqual(before);
});
