import {calculateCorrelations} from './correlationMath';import type {NumericModelCase} from './linearModelMath';
const scope=self as unknown as {onmessage:((event:MessageEvent<{cases:NumericModelCase[];fieldCount:number}>)=>void)|null;postMessage:(value:unknown)=>void};
scope.onmessage=event=>{try{scope.postMessage({type:'complete',result:calculateCorrelations(event.data.cases,event.data.fieldCount)});}catch(error){scope.postMessage({type:'failed',message:error instanceof Error?error.message:'Correlation calculation failed.'});}};
