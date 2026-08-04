import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: {
        resolveMerchantId: vi
            .fn()
            .mockResolvedValue("9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"),
    },
}));

import { decodeProof } from "../identity/canonical";
import { ensureIdentityKey, getPendingLegacyId } from "../identity/sign";
import { migrateLegacyIdentity } from "./migrateLegacyIdentity";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const LEGACY_ID = "legacy-random-id";

/** Derive a real key/id pair over a stored legacy id, as a first visit would. */
async function migratingClient() {
    localStorage.setItem("frak-client-id", LEGACY_ID);
    const { clientId, pendingLegacyId } = await ensureIdentityKey();
    return { derivedId: clientId, pendingLegacyId };
}

function okJson(value: unknown) {
    return { ok: true, status: 200, json: async () => value };
}

describe("migrateLegacyIdentity", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("merges the legacy id into the derived one and clears the marker", async () => {
        const { derivedId, pendingLegacyId } = await migratingClient();
        expect(pendingLegacyId).toBe(LEGACY_ID);

        fetchSpy
            .mockResolvedValueOnce(okJson({ mergeToken: "merge-token-abc" }))
            .mockResolvedValueOnce(okJson({ merged: true }));

        await migrateLegacyIdentity({ legacyId: LEGACY_ID, derivedId });

        expect(fetchSpy).toHaveBeenCalledTimes(2);

        // initiate: the SOURCE is the derived id, which is what the proof
        // covers — the legacy id can never be proven.
        const [initiateUrl, initiateInit] = fetchSpy.mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(initiateUrl).toContain("/user/identity/merge/initiate");
        const initiateBody = JSON.parse(initiateInit.body as string);
        expect(initiateBody.sourceAnonymousId).toBe(derivedId);
        expect(initiateBody.merchantId).toBe(MERCHANT_ID);

        const envelope = decodeProof(initiateBody.proof);
        expect(envelope).not.toBeNull();

        // execute: the TARGET is the legacy id, carried unproven — exactly
        // the latch-gated arm the backend keeps open for ids with no key.
        const [executeUrl, executeInit] = fetchSpy.mock.calls[1] as [
            string,
            RequestInit,
        ];
        expect(executeUrl).toContain("/user/identity/merge/execute");
        const executeBody = JSON.parse(executeInit.body as string);
        expect(executeBody.targetAnonymousId).toBe(LEGACY_ID);
        expect(executeBody.mergeToken).toBe("merge-token-abc");

        expect(getPendingLegacyId()).toBeUndefined();
    });

    it("keeps the marker on a 5xx so the next visit retries", async () => {
        const { derivedId } = await migratingClient();
        fetchSpy.mockResolvedValueOnce({ ok: false, status: 503 });

        await migrateLegacyIdentity({ legacyId: LEGACY_ID, derivedId });

        expect(getPendingLegacyId()).toBe(LEGACY_ID);
    });

    it("keeps the marker when the network throws", async () => {
        const { derivedId } = await migratingClient();
        fetchSpy.mockRejectedValueOnce(new Error("offline"));

        await migrateLegacyIdentity({ legacyId: LEGACY_ID, derivedId });

        expect(getPendingLegacyId()).toBe(LEGACY_ID);
    });

    it("keeps the marker when execute fails transiently", async () => {
        const { derivedId } = await migratingClient();
        fetchSpy
            .mockResolvedValueOnce(okJson({ mergeToken: "merge-token-abc" }))
            .mockResolvedValueOnce({ ok: false, status: 500 });

        await migrateLegacyIdentity({ legacyId: LEGACY_ID, derivedId });

        expect(getPendingLegacyId()).toBe(LEGACY_ID);
    });

    it("drops the marker on a 4xx, which retrying can never fix", async () => {
        const { derivedId } = await migratingClient();
        fetchSpy.mockResolvedValueOnce({ ok: false, status: 403 });

        await migrateLegacyIdentity({ legacyId: LEGACY_ID, derivedId });

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(getPendingLegacyId()).toBeUndefined();
    });

    it("never merges an id into itself", async () => {
        const { derivedId } = await migratingClient();

        await migrateLegacyIdentity({
            legacyId: derivedId,
            derivedId,
        });

        expect(fetchSpy).not.toHaveBeenCalled();
        expect(getPendingLegacyId()).toBeUndefined();
    });

    it("aborts without calling the backend when no proof can be produced", async () => {
        // No key on file ⇒ `signProof` returns null. Sending anyway would
        // just 403 on the proof-required initiate arm.
        localStorage.clear();

        await migrateLegacyIdentity({
            legacyId: LEGACY_ID,
            derivedId: "11111111-1111-4111-8111-111111111111",
        });

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
