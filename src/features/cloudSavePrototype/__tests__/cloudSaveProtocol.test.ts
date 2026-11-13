import { describe, expect, it } from "vitest";
import { CloudSaveClient, MemoryDevice } from "../cloudSaveClient";
import { decodeSnapshot, digest, encodeSnapshot, objectKey, syntheticSnapshot } from "../contracts";
import type { CloudPort, SaveIntent } from "../contracts";
import { FakeCloudConnection, FakeCloudServer } from "../fakeCloud";
import type { Fault } from "../fakeCloud";

function setup() {
  const server = new FakeCloudServer(), wire = new FakeCloudConnection(server), device = new MemoryDevice();
  const client = new CloudSaveClient(wire, device);
  const alice = server.signIn("synthetic-alice"), bob = server.signIn("synthetic-bob");
  client.setSession(alice);
  return { server, wire, device, client, alice, bob };
}
async function intent(overrides: Partial<SaveIntent> = {}): Promise<SaveIntent> {
  const body = overrides.body ?? encodeSnapshot(syntheticSnapshot());
  return { owner: "synthetic-alice", workspaceId: "synthetic-workspace", operationId: "operation-one", expectedHead: null,
    body, digest: await digest(body), ...overrides };
}
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function wrapped(wire: FakeCloudConnection, overrides: Partial<CloudPort>): CloudPort {
  return { owner: token => wire.owner(token), uploadImmutable: (token, value) => wire.uploadImmutable(token, value),
    publishRevision: (token, value) => wire.publishRevision(token, value), head: (token, id) => wire.head(token, id),
    download: (token, key) => wire.download(token, key), ...overrides };
}

describe("synthetic cloud-save protocol, not live Supabase security", () => {
  it("acknowledges only a published revision and never mutates the active snapshot", async () => {
    const { client, device, server, alice } = setup();
    const before = JSON.stringify(device.snapshot);
    await client.save();
    expect(client.state).toBe("cloud-copy-saved");
    expect(server.diagnostics()).toEqual({ objects: 1, publishedRevisions: 1, heads: 1 });
    expect(server.head(alice, client.workspaceId)?.parentId).toBeNull();
    expect(device.pending.size).toBe(0); expect(JSON.stringify(device.snapshot)).toBe(before);
  });
  it("does not accept arbitrary data with a synthetic marker", async () => {
    const { wire, alice, server } = setup();
    for (const data of [{ ...syntheticSnapshot(), title: "Actual customer" }, { ...syntheticSnapshot(), credential: "secret" },
      { ...syntheticSnapshot(), rows: [{ respondent: "real respondent", score: 1 }] }, { ...syntheticSnapshot(), version: 2 }]) {
      const body = JSON.stringify(data);
      await expect(wire.uploadImmutable(alice, await intent({ body }))).rejects.toMatchObject({ code: "integrity" });
    }
    expect(server.diagnostics().objects).toBe(0);
    expect(() => decodeSnapshot(" ".repeat(4097))).toThrow();
  });
  it("rejects hidden data in duplicate JSON keys and non-canonical bodies", async () => {
    const { wire, alice, server } = setup();
    const canonical = encodeSnapshot(syntheticSnapshot());
    for (const body of [canonical.replace('"title":', '"title":"arbitrary hidden text","title":'), " " + canonical]) {
      await expect(wire.uploadImmutable(alice, await intent({ body }))).rejects.toMatchObject({ code: "integrity" });
    }
    expect(server.diagnostics().objects).toBe(0);
  });
  it("does not publish when the account changes during snapshot hashing", async () => {
    const { client, bob, server } = setup();
    const saving = client.save(); client.setSession(bob); await saving;
    expect(client.state).toBe("local-only"); expect(client.device.pending.size).toBe(0);
    expect(server.diagnostics().objects).toBe(0);
  });
  it("retains a successful old-account operation if switching before its acknowledgement", async () => {
    const { wire, alice, bob, server } = setup(), committed = deferred<void>(), proceed = deferred<void>();
    const client = new CloudSaveClient(wrapped(wire, { publishRevision: async (token, value) => {
      const revision = await wire.publishRevision(token, value); committed.resolve(); await proceed.promise; return revision;
    } })); client.setSession(alice);
    const saving = client.save(); await committed.promise; client.setSession(bob); proceed.resolve(); await saving;
    expect(client.state).toBe("local-only"); expect(client.device.pending.size).toBe(1);
    expect(server.diagnostics().publishedRevisions).toBe(1);
    client.setSession(alice); await client.save(); expect(client.state).toBe("cloud-copy-saved");
    expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("retains the pending intent when the session expires after commit before acknowledgement", async () => {
    const { wire, alice, server } = setup(); let expire = true;
    const client = new CloudSaveClient(wrapped(wire, { publishRevision: async (token, value) => {
      const revision = await wire.publishRevision(token, value); if (expire) server.advanceTime(60_001); return revision;
    } })); client.setSession(alice); await client.save();
    expect(client.state).toBe("sign-in-required"); expect(client.device.pending.size).toBe(1);
    expect(server.diagnostics().publishedRevisions).toBe(1);
    expire = false; client.setSession(server.signIn("synthetic-alice")); await client.save();
    expect(client.state).toBe("cloud-copy-saved"); expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("rejects a mismatched acknowledgement and keeps its pending intent", async () => {
    const { wire, alice, server } = setup();
    const client = new CloudSaveClient(wrapped(wire, { publishRevision: async (token, value) => ({
      ...await wire.publishRevision(token, value), operationId: "wrong-operation"
    }) })); client.setSession(alice); await client.save();
    expect(client.state).toBe("error"); expect(client.device.pending.size).toBe(1); expect(client.device.heads.size).toBe(0);
    expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("requires a verified upload before publication, leaving no partial revision", async () => {
    const { wire, alice, server } = setup();
    await expect(wire.publishRevision(alice, await intent())).rejects.toMatchObject({ code: "integrity" });
    expect(server.diagnostics()).toEqual({ objects: 0, publishedRevisions: 0, heads: 0 });
  });
  it("rejects a checksum mismatch before creating an object", async () => {
    const { wire, alice, server } = setup();
    await expect(wire.uploadImmutable(alice, await intent({ digest: "bad" }))).rejects.toMatchObject({ code: "integrity" });
    expect(server.diagnostics().objects).toBe(0);
  });
  it("enforces owner isolation at upload, publish, head and private object download", async () => {
    const { client, wire, alice, bob, server } = setup();
    await client.save();
    const head = server.head(alice, client.workspaceId)!;
    expect(await wire.head(bob, client.workspaceId)).toBeNull();
    await expect(wire.download(bob, head.objectKey)).rejects.toMatchObject({ code: "forbidden" });
    const plan = await intent();
    await expect(wire.uploadImmutable(bob, plan)).rejects.toMatchObject({ code: "forbidden" });
    await expect(wire.publishRevision(bob, plan)).rejects.toMatchObject({ code: "forbidden" });
    await expect(wire.download(null, head.objectKey)).rejects.toMatchObject({ code: "auth" });
    await expect(wire.uploadImmutable("forged-synthetic-alice", plan)).rejects.toMatchObject({ code: "auth" });
    expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it.each(["../other", "a/b", "a%2fb", "", "x".repeat(101)])("rejects unsafe resource identifier %s", async workspaceId => {
    const { wire, alice, server } = setup();
    await expect(wire.uploadImmutable(alice, await intent({ workspaceId }))).rejects.toMatchObject({ code: "invalid" });
    expect(server.diagnostics().objects).toBe(0);
  });
  it("allows identical retry but refuses immutable object replacement", async () => {
    const { wire, alice, server } = setup(), plan = await intent();
    await wire.uploadImmutable(alice, plan); await wire.uploadImmutable(alice, plan);
    const changed = await intent({ body: encodeSnapshot(syntheticSnapshot(1)) });
    await expect(wire.uploadImmutable(alice, changed)).rejects.toMatchObject({ code: "idempotency" });
    expect(await wire.download(alice, objectKey(plan))).toBe(plan.body);
    expect(server.diagnostics().objects).toBe(1);
  });
  it.each<Fault>(["before-upload", "after-upload", "before-publish", "after-publish"])("recovers %s by retrying one immutable operation", async fault => {
    const { client, wire, device, server } = setup();
    wire.failNext(fault); await client.save();
    expect(client.state).toBe("interrupted"); expect(device.pending.size).toBe(1);
    expect(server.diagnostics().publishedRevisions).toBe(fault === "after-publish" ? 1 : 0);
    const pending = [...device.pending.values()][0];
    await client.save(); expect(client.state).toBe("cloud-copy-saved");
    expect(server.diagnostics()).toEqual({ objects: 1, publishedRevisions: 1, heads: 1 });
    expect(device.heads.get(`${pending.owner}/${pending.workspaceId}`)).toBeTruthy();
  });
  it("recreates a client over the SAME memory journal after lost acknowledgement", async () => {
    const { client, wire, device, alice, server } = setup();
    wire.failNext("after-publish"); await client.save();
    const restarted = new CloudSaveClient(wire, device); restarted.setSession(alice); await restarted.save();
    expect(restarted.state).toBe("cloud-copy-saved"); expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("reconciles an old receipt after a different editor advances the head", async () => {
    const { wire, alice, server } = setup(), first = await intent();
    await wire.uploadImmutable(alice, first); const revision = await wire.publishRevision(alice, first);
    const next = await intent({ operationId: "operation-two", expectedHead: revision.revisionId, body: encodeSnapshot(syntheticSnapshot(1)) });
    await wire.uploadImmutable(alice, next); const second = await wire.publishRevision(alice, next);
    expect(await wire.publishRevision(alice, first)).toEqual(revision);
    expect(server.head(alice, first.workspaceId)).toEqual(second);
    expect(server.diagnostics().publishedRevisions).toBe(2);
  });
  it("rejects a reused request ID with a changed base revision", async () => {
    const { wire, alice, server } = setup(), first = await intent();
    await wire.uploadImmutable(alice, first); const revision = await wire.publishRevision(alice, first);
    await expect(wire.publishRevision(alice, { ...first, expectedHead: revision.revisionId })).rejects.toMatchObject({ code: "idempotency" });
    expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("conflicting first saves keep both versions and never silently rebase", async () => {
    const { client, device, wire, alice, server } = setup();
    const other = new CloudSaveClient(new FakeCloudConnection(server)); other.setSession(alice); other.edit();
    await Promise.all([client.save(), other.save()]);
    expect([client.state, other.state].sort()).toEqual(["cloud-copy-saved", "conflict"]);
    const loser = client.state === "conflict" ? client : other;
    const local = JSON.stringify(loser.device.snapshot), pending = [...loser.device.pending.values()][0];
    await loser.save(); expect(loser.state).toBe("conflict");
    await loser.restoreSeparateCopy();
    expect(JSON.stringify(loser.device.snapshot)).toBe(local);
    expect([...loser.device.pending.values()][0]).toEqual(pending);
    expect(loser.device.heads.size).toBe(0);
    expect(server.diagnostics()).toEqual({ objects: 2, publishedRevisions: 1, heads: 1 });
    expect(device.snapshot.edit).toBe(0); expect(wire.online).toBe(true);
  });
  it("serializes concurrent repeated Save clicks into one operation", async () => {
    const { client, server } = setup();
    const first = client.save(), second = client.save(); expect(second).toBe(first);
    await Promise.all([first, second]); expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("preserves a newer local edit while acknowledging the frozen older save", async () => {
    const { client, device, server } = setup();
    const saving = client.save(); client.edit(); await saving;
    expect(client.state).toBe("local-changes"); expect(device.snapshot.edit).toBe(1);
    await client.save(); expect(client.state).toBe("cloud-copy-saved"); expect(server.diagnostics().publishedRevisions).toBe(2);
  });
  it("retries the pending version before attempting any newer edit", async () => {
    const { client, wire, server, alice } = setup();
    wire.failNext("after-publish"); await client.save(); client.edit(); await client.save();
    expect(client.state).toBe("local-changes"); expect(server.diagnostics().publishedRevisions).toBe(1);
    const head = server.head(alice, client.workspaceId)!;
    expect(decodeSnapshot(await wire.download(alice, head.objectKey)).edit).toBe(0);
    await client.save(); expect(client.state).toBe("cloud-copy-saved"); expect(server.diagnostics().publishedRevisions).toBe(2);
  });
  it("offline local edits remain usable and never claim cloud durability", async () => {
    const { client, wire, device, server } = setup(); wire.online = false; client.edit(); await client.save();
    expect(client.state).toBe("offline"); expect(device.snapshot.edit).toBe(1); expect(device.pending.size).toBe(1);
    expect(server.diagnostics().objects).toBe(0);
    wire.online = true; await client.save(); expect(client.state).toBe("cloud-copy-saved");
  });
  it("expired sessions do not upload; reauthentication can retry the same operation", async () => {
    const { client, wire, device, server } = setup();
    wire.failNext("after-upload"); await client.save(); const pending = [...device.pending.values()][0];
    server.advanceTime(60_001); await client.save(); expect(client.state).toBe("sign-in-required");
    expect(server.diagnostics()).toEqual({ objects: 1, publishedRevisions: 0, heads: 0 });
    expect([...device.pending.values()][0]).toBe(pending);
    client.setSession(server.signIn("synthetic-alice")); await client.save(); expect(client.state).toBe("cloud-copy-saved");
  });
  it("expiry between upload and publication leaves an unpublished object", async () => {
    const { wire, alice, server } = setup();
    const client = new CloudSaveClient(wrapped(wire, { uploadImmutable: async (token, value) => {
      await wire.uploadImmutable(token, value); server.advanceTime(60_001);
    } })); client.setSession(alice); await client.save();
    expect(client.state).toBe("sign-in-required");
    expect(server.diagnostics()).toEqual({ objects: 1, publishedRevisions: 0, heads: 0 });
  });
  it("an account switch during upload cannot publish or adopt an old-account response", async () => {
    const { wire, alice, bob, server } = setup(), uploaded = deferred<void>(), proceed = deferred<void>();
    const client = new CloudSaveClient(wrapped(wire, { uploadImmutable: async (token, value) => {
      await wire.uploadImmutable(token, value); uploaded.resolve(); await proceed.promise;
    } })); client.setSession(alice); const saving = client.save(); await uploaded.promise;
    client.setSession(bob); proceed.resolve(); await saving;
    expect(client.state).toBe("local-only"); expect(server.diagnostics().publishedRevisions).toBe(0);
    expect(client.device.pending.size).toBe(1);
    client.setSession(alice); await client.save(); expect(server.diagnostics().publishedRevisions).toBe(1);
  });
  it("keeps per-owner pending operations separate across account switching", async () => {
    const { wire, client, device, bob, alice, server } = setup();
    wire.failNext("after-upload"); await client.save();
    client.setSession(bob); client.edit(); await client.save(); expect(client.state).toBe("cloud-copy-saved");
    expect(device.pending.size).toBe(1);
    client.setSession(alice); await client.save(); expect(client.state).toBe("local-changes");
    expect(server.diagnostics().heads).toBe(2); expect(device.pending.size).toBe(0);
  });
  it("restores unique separate copies without replacing active work or the cloud head", async () => {
    const { client, device, server, alice } = setup(); await client.save(); const head = server.head(alice, client.workspaceId);
    client.edit(); const local = JSON.stringify(device.snapshot);
    const one = await client.restoreSeparateCopy(), two = await client.restoreSeparateCopy();
    expect(one?.snapshot.edit).toBe(0); expect(two?.id).not.toBe(one?.id);
    expect(JSON.stringify(device.snapshot)).toBe(local); expect(server.head(alice, client.workspaceId)).toEqual(head);
    expect(device.restoredCopies).toHaveLength(2);
  });
  it("deduplicates concurrent restore clicks but permits later deliberate copies", async () => {
    const { client, device } = setup(); await client.save();
    const one = client.restoreSeparateCopy(), two = client.restoreSeparateCopy(); expect(one).toBe(two);
    await one; expect(device.restoredCopies).toHaveLength(1);
    await client.restoreSeparateCopy(); expect(device.restoredCopies).toHaveLength(2);
  });
  it.each<Fault>(["before-download", "corrupt-download"])("%s never restores damaged or partial data", async fault => {
    const { client, device, wire } = setup(); await client.save(); client.edit();
    wire.failNext(fault); const local = JSON.stringify(device.snapshot);
    expect(await client.restoreSeparateCopy()).toBeNull(); expect(device.restoredCopies).toHaveLength(0);
    expect(JSON.stringify(device.snapshot)).toBe(local);
  });
  it("rejects expiry while a download is in flight", async () => {
    const { wire, alice, server } = setup();
    const client = new CloudSaveClient(wrapped(wire, { download: async (token, key) => {
      const body = await wire.download(token, key); server.advanceTime(60_001); return body;
    } })); client.setSession(alice); await client.save();
    expect(await client.restoreSeparateCopy()).toBeNull(); expect(client.state).toBe("sign-in-required");
    expect(client.device.restoredCopies).toHaveLength(0);
  });
  it("drops a downloaded copy when the account changed before completion", async () => {
    const { wire, alice, bob } = setup(), downloading = deferred<void>(), proceed = deferred<void>();
    const client = new CloudSaveClient(wrapped(wire, { download: async (token, key) => {
      const body = await wire.download(token, key); downloading.resolve(); await proceed.promise; return body;
    } })); client.setSession(alice); await client.save(); const restoring = client.restoreSeparateCopy(); await downloading.promise;
    client.setSession(bob); proceed.resolve(); expect(await restoring).toBeNull(); expect(client.device.restoredCopies).toHaveLength(0);
  });
});
