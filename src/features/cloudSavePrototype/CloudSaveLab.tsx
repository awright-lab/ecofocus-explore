import { useState } from "react";
import { CloudSaveClient } from "./cloudSaveClient";
import type { Owner } from "./contracts";
import { FakeCloudConnection, FakeCloudServer } from "./fakeCloud";
import type { Fault } from "./fakeCloud";
import "./lab.css";

function createLab() {
  const server = new FakeCloudServer();
  const wires = [new FakeCloudConnection(server), new FakeCloudConnection(server)];
  return { server, wires, clients: wires.map(wire => new CloudSaveClient(wire)) };
}
const faults: { value: Fault; label: string }[] = [
  { value: "before-upload", label: "Interrupt before upload" },
  { value: "after-upload", label: "Lose upload acknowledgement" },
  { value: "before-publish", label: "Interrupt before publication" },
  { value: "after-publish", label: "Lose publication acknowledgement" },
  { value: "before-download", label: "Interrupt download" },
  { value: "corrupt-download", label: "Corrupt downloaded bytes" }
];
export function CloudSaveLab() {
  const [lab, setLab] = useState(createLab);
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion(value => value + 1);
  const counts = lab.server.diagnostics();
  return <main className="cloud-lab" data-render-version={version}>
    <header><span className="lab-eyebrow">ECOFOCUS / PROTOCOL LAB</span><h1>A cloud copy.<br />Your local work stays yours.</h1>
      <p className="lab-lead">Explore safe save and restore behavior with two simulated devices.</p></header>
    <aside className="lab-notice"><strong>Synthetic demo only. No real cloud connection.</strong>
      <p>All accounts, survey rows and storage are generated in memory. This page never reads your browser workspace or uploads data. Reloading clears the entire demo. Live Supabase authentication, RLS and security are not verified.</p></aside>
    <section className="lab-metrics" aria-label="Simulated server diagnostics">
      <div><strong>{counts.objects}</strong><span>immutable objects</span></div>
      <div><strong>{counts.publishedRevisions}</strong><span>published revisions</span></div>
      <div><strong>{counts.heads}</strong><span>cloud heads</span></div>
      <button onClick={() => { lab.server.advanceTime(60_001); refresh(); }}>Expire simulated sessions</button>
      <button onClick={() => setLab(createLab())}>Reset synthetic demo</button>
    </section>
    <div className="lab-devices">
      {lab.clients.map((client, index) => <Device key={index} client={client} wire={lab.wires[index]} index={index} refresh={refresh} />)}
    </div>
    <section className="lab-guide"><h2>Try the failure paths</h2><ol>
      <li>Sign both devices in as Alice. Save on device A, then save on device B. B reports a conflict and preserves its local version.</li>
      <li>On B, restore a separate copy to compare. It does not replace B’s active copy or silently clear the conflict.</li>
      <li>Reset. Sign in, select “Lose publication acknowledgement” and save. One revision exists. Retry publishes no duplicate.</li>
      <li>Switch to Bob. Alice’s private cloud copy is unavailable. Try going offline or expiring a session, then retry after reconnecting or signing in.</li>
    </ol><p>This lab models a protocol, not production durability. A real implementation still needs a reviewed private bucket, server-side ownership checks, a transactional revision RPC, durable pending operations and live failure tests.</p></section>
  </main>;
}
function Device({ client, wire, index, refresh }: { client: CloudSaveClient; wire: FakeCloudConnection; index: number; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  let owner: Owner | "" = "";
  try { owner = wire.owner(client.session); } catch { /* Signed out/expired: no authenticated copy list. */ }
  async function run(action: () => Promise<unknown>) {
    setBusy(true); const result = action(); refresh();
    try { await result; } finally { setBusy(false); refresh(); }
  }
  const scope = owner ? `${owner}/${client.workspaceId}` : "";
  const pending = client.device.pending.get(scope);
  const copies = client.device.restoredCopies.filter(copy => copy.owner === owner);
  return <section className="lab-device" aria-label={`Device ${index === 0 ? "A" : "B"}`}>
    <div className="lab-device-heading"><h2>Device {index === 0 ? "A" : "B"}</h2><span className="lab-badge">{wire.online ? "Online (simulated)" : "Offline"}</span></div>
    <div className="lab-controls"><label>Simulated account<select aria-label={`Device ${index + 1} account`} value={owner} onChange={event => {
      client.setSession(event.target.value ? wire.server.signIn(event.target.value as Owner) : null); refresh();
    }}><option value="">Signed out or expired</option><option value="synthetic-alice">Alice (synthetic)</option><option value="synthetic-bob">Bob (synthetic)</option></select></label>
      <label className="lab-check"><input type="checkbox" checked={!wire.online} onChange={event => { wire.online = !event.target.checked; refresh(); }} />Work offline</label></div>
    <div className="lab-local"><span className="lab-eyebrow">ACTIVE LOCAL COPY / MEMORY ONLY</span><h3>{client.device.snapshot.title}</h3>
      <table><thead><tr><th>Generated respondent</th><th>Score</th></tr></thead><tbody>{client.device.snapshot.rows.map(row => <tr key={row.respondent}><td>{row.respondent}</td><td>{row.score}</td></tr>)}</tbody></table>
      <button onClick={() => { client.edit(); refresh(); }}>Make synthetic edit</button></div>
    <div className="lab-status" role="status" data-state={client.state}><strong>{client.state.replaceAll("-", " ")}</strong><p>{client.message}</p>
      {pending && <small>Pending synthetic edit {JSON.parse(pending.body).edit}. Retry keeps the same operation ID and expected revision.</small>}</div>
    <div className="lab-actions"><button className="lab-primary" disabled={busy} onClick={() => void run(() => client.save())}>{pending ? "Retry pending cloud copy" : "Save cloud copy"}</button>
      <button disabled={busy} onClick={() => void run(() => client.restoreSeparateCopy())}>Restore separate copy</button></div>
    <label className="lab-fault">Next simulated failure<select defaultValue="" aria-label={`Device ${index + 1} failure`} onChange={event => {
      if (event.target.value) { wire.failNext(event.target.value as Fault); refresh(); }
      event.target.value = "";
    }}><option value="">Choose a one-time failure…</option>{faults.map(fault => <option key={fault.value} value={fault.value}>{fault.label}</option>)}</select>{wire.armedFault() && <small>Armed: {faults.find(fault => fault.value === wire.armedFault())?.label}</small>}</label>
    <section className="lab-restored" aria-label="Separate restored copies"><h3>Separate restored copies <span>{copies.length}</span></h3>
      {copies.length === 0 ? <p>No restored copies for the current account.</p> : <ul>{copies.map(copy => <li key={copy.id}><strong>{copy.snapshot.title}</strong><span>Source: {copy.sourceRevision}. Separate ID; active work unchanged.</span></li>)}</ul>}
    </section>
  </section>;
}
