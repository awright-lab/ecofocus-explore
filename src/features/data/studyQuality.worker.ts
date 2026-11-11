import {buildNumericProfileFromValues} from './importedNumericProfile';
import {buildCategoricalProfileFromValues} from './importedCategoricalProfile';
import type {ImportedDatasetField} from '../../../shared/types/dashboard';
const scope=self as unknown as {onmessage:((event:MessageEvent<{index:number;values:string[];field:ImportedDatasetField}>)=>void)|null;postMessage:(message:unknown)=>void};
scope.onmessage=event=>{const {index,values,field}=event.data;try{
 const kind=field.type==='numeric'||field.modelingRole==='candidate_measure'?'numeric':field.type==='categorical'||field.modelingRole==='candidate_dimension'?'categorical':'other';
 if(kind==='numeric'){scope.postMessage({index,kind,profile:buildNumericProfileFromValues(values)});return;}
 if(kind==='categorical'){scope.postMessage({index,kind,profile:buildCategoricalProfileFromValues(values,field)});return;}
 const nonblank=values.filter(value=>value.trim());scope.postMessage({index,kind,blank:values.length-nonblank.length,distinct:new Set(nonblank).size});
 }catch{scope.postMessage({index,kind:'error'});}};
