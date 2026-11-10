import {importDatasetFile} from "../../datasetImportModel";
import {sizedXlsxFixture} from "../xlsxIntegrityFixture";
import {sav} from "./savCaseFixture";
export async function localFileReuseFixture(format:"xlsx"|"sav"){
 const bytes=format==="sav"?sav():null;
 const file=format==="xlsx"?sizedXlsxFixture():{name:"synthetic-reuse.sav",size:bytes!.byteLength,arrayBuffer:async()=>bytes!.slice(0)} as File;
 const result=await importDatasetFile(file);if(!result.dataset)throw Error(result.error??"Synthetic file failed");return{file,dataset:result.dataset};
}
