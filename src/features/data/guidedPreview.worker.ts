import {calculateGuidedPreview,type GuidedPreviewRequest} from './guidedPreviewModel';
const scope=self as unknown as{onmessage:((event:MessageEvent<GuidedPreviewRequest>)=>void)|null;postMessage:(data:unknown)=>void};
scope.onmessage=event=>{try{scope.postMessage({type:'complete',result:calculateGuidedPreview(event.data)});}catch(error){scope.postMessage({type:'failed',message:error instanceof Error?error.message:'The complete preview could not be calculated.'});}};
