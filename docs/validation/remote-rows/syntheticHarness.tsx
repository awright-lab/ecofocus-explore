import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteRowsInspector } from '../../../src/features/data/remote-rows/RemoteRowsInspector';
import { syntheticRemoteRows } from '../../../src/features/data/remote-rows/syntheticRemoteRows';
if (!import.meta.env.DEV) throw Error('Synthetic fixture is development only.');
const source = { datasetId:'synthetic', datasetRevision:'synthetic-data-1', schemaRevision:'synthetic-schema-1' };
const fixture = syntheticRemoteRows(source);
Object.assign(window, { syntheticRemoteStats: fixture.stats });
function Harness() { const [open,setOpen]=useState(false); return <><main><h1>Synthetic development fixture</h1><p>One million logical rows, 10,000 fields. No server or real data.</p><button onClick={()=>setOpen(true)}>Inspect synthetic rows</button></main>{open && <RemoteRowsInspector source={source} provider={fixture.provider} onClose={()=>setOpen(false)}/>}</>; }
createRoot(document.getElementById('root')!).render(<Harness/>);
