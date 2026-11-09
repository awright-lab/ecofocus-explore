import {dotPlotFixture} from './dotPlotFixture';
import {runImportedDatasetQuery} from '../../data/importedDatasetAnalytics';
import {dotIntervalCandidate,dotIntervalMethod} from '../dotPlotIntervals';
export async function dotIntervalFixture(){
 const f=await dotPlotFixture();f.tile.result=runImportedDatasetQuery({dataset:f.dataset,field:f.dataset.fields[0],bannerField:f.dataset.fields[1],metric:'percent_selected',chartType:'dot_plot'});f.tile.query=structuredClone(f.tile.result.query);
 f.tile.appearance.dotPlotIntervals={method:dotIntervalMethod,binding:dotIntervalCandidate(f.tile).binding};return f;
}
