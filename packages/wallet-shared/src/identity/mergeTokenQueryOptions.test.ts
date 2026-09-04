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

    it("counts a proofless anonymous-source call and refuses it", async () => {
        const result = await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
        });

        expect(result).toBeNull();
        expect(mockInitiatePost).not.toHaveBeenCalled();
        expect(mockTrackEvent).toHaveBeenCalledWith("merge_initiate_proofless");
    });

    it("never counts the wallet-auth arm, which names no anonymous id", async () => {
        await runQuery({
            merchantId: MERCHANT,
        });

        expect(mockTrackEvent).not.toHaveBeenCalled();
        expect(mockInitiatePost).toHaveBeenCalledWith({ merchantId: MERCHANT });
    });

    it("refuses to persist the token, which is a 60-minute bearer", () => {
        const options = mergeTokenQueryOptions({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
        });

        expect(options.meta).toEqual({ storable: false });
    });

    it("forwards the proof to the backend", async () => {
        await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
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
            proof: "the-source-proof",
        });

        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("keys on proof presence, never on the proof itself", () => {
        const proofless = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
        });
        const proven = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            proof: "secret-bearer-material",
        });

        expect(proven).not.toEqual(proofless);
        expect(JSON.stringify(proven)).not.toContain("secret-bearer-material");
    });

    it("keeps one cache entry as a proof is re-signed", () => {
        const first = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            proof: "proof-signed-at-t0",
        });
        const refreshed = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            proof: "proof-signed-at-t1",
        });

        expect(refreshed).toEqual(first);
    });

    it("lets two listener surfaces share one entry, and separates the wallet-auth arm", () => {
        const modal = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            proof: "the-source-proof",
        });
        const embedded = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            proof: "the-source-proof",
        });
        const walletAuth = mergeTokenKeys.byParams({
            merchantId: MERCHANT,
        });

        expect(modal).toEqual(embedded);
        expect(modal).not.toEqual(walletAuth);
        expect(modal.slice(0, mergeTokenKeys.all.length)).toEqual([
            ...mergeTokenKeys.all,
        ]);
    });
});
