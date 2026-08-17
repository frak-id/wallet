import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTrackEvent = vi.fn();
const mockInitiatePost = vi.fn();

vi.mock("../common/analytics", () => ({
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("../common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                merge: {
                    initiate: {
                        post: (...args: unknown[]) => mockInitiatePost(...args),
                    },
                },
            },
        },
    },
}));

const { mergeTokenKeys, mergeTokenQueryOptions } = await import(
    "./mergeTokenQueryOptions"
);

const MERCHANT = "merchant-1";

async function runQuery(
    args: Parameters<typeof mergeTokenQueryOptions>[0]
): Promise<string | null> {
    const options = mergeTokenQueryOptions(args);
    return await (options.queryFn as unknown as () => Promise<string | null>)();
}

describe("mergeTokenQueryOptions", () => {
    beforeEach(() => {
        mockTrackEvent.mockReset();
        mockInitiatePost.mockReset();
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "token" } });
    });

    it("counts the listener modal's proofless call and refuses it", async () => {
        const result = await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
        });

        expect(result).toBeNull();
        expect(mockInitiatePost).not.toHaveBeenCalled();

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "merge_initiate_proofless",
            {
                source: "listener_modal",
            }
        );
    });

    it("counts the embedded wallet separately from the modal", async () => {
        const result = await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "embedded_wallet",
        });

        expect(result).toBeNull();
        expect(mockInitiatePost).not.toHaveBeenCalled();

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "merge_initiate_proofless",
            {
                source: "embedded_wallet",
            }
        );
    });

    it("never counts the wallet explorer, whose arm is authenticated by session", async () => {
        await runQuery({
            merchantId: MERCHANT,
            source: "wallet_explorer",
        });

        expect(mockTrackEvent).not.toHaveBeenCalled();
        expect(mockInitiatePost).toHaveBeenCalledWith({ merchantId: MERCHANT });
    });

    it("refuses, but does not count, a wallet_explorer call carrying an anonymous id", async () => {
        const result = await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "wallet_explorer",
        });

        // Field-based like the backend, which enforces on `sourceAnonymousId`
        // alone; the counter stays source-based and excludes this arm.
        expect(result).toBeNull();
        expect(mockInitiatePost).not.toHaveBeenCalled();
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("refuses to persist the token, which is a 60-minute bearer", () => {
        const options = mergeTokenQueryOptions({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
        });

        expect(options.meta).toEqual({ storable: false });
    });

    it("forwards the proof to the backend", async () => {
        await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
            proof: "the-source-proof",
        });

        expect(mockInitiatePost).toHaveBeenCalledWith({
            sourceAnonymousId: "anon-1",
            proof: "the-source-proof",
            merchantId: MERCHANT,
        });
    });

    it("does not count a proven call", async () => {
        await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
            proof: "the-source-proof",
        });

        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("keys on proof presence, never on the proof itself", () => {
        const proofless = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
        });
        const proven = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
            proof: "secret-bearer-material",
        });

        expect(proven).not.toEqual(proofless);
        expect(JSON.stringify(proven)).not.toContain("secret-bearer-material");
    });

    it("keeps one cache entry as a proof is re-signed", () => {
        const first = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            source: "listener_modal",
            proof: "proof-signed-at-t0",
        });
        const refreshed = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            source: "listener_modal",
            proof: "proof-signed-at-t1",
        });

        expect(refreshed).toEqual(first);
    });

    it("keys the cache on source, so the modal and the explorer cannot share an entry", () => {
        const modal = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            source: "listener_modal",
        });
        const explorer = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            source: "wallet_explorer",
        });

        expect(modal).not.toEqual(explorer);
        expect(modal.slice(0, mergeTokenKeys.all.length)).toEqual([
            ...mergeTokenKeys.all,
        ]);
    });
});
