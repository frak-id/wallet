import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockInitiatePost = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
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

import { createGetMergeTokenHandler } from "./useOnGetMergeToken";

const CONTEXT = {
    merchantId: "merchant-1",
    clientId: "client-1",
} as Parameters<ReturnType<typeof createGetMergeTokenHandler>>[1];

describe("createGetMergeTokenHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("forwards the proof when present", async () => {
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "tok" } });
        const handler = createGetMergeTokenHandler();

        const result = await handler(["the-proof"], CONTEXT);

        expect(result).toBe("tok");
        expect(mockInitiatePost).toHaveBeenCalledWith({
            sourceAnonymousId: "client-1",
            merchantId: "merchant-1",
            proof: "the-proof",
        });
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("refuses a legacy SDK that sends no proof at all", async () => {
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "tok" } });
        const handler = createGetMergeTokenHandler();

        const result = await handler(undefined, CONTEXT);

        expect(result).toBeNull();
        expect(mockInitiatePost).not.toHaveBeenCalled();
    });

    test("falls back to the stored mergeSource proof when the RPC param is absent", async () => {
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "tok" } });
        const handler = createGetMergeTokenHandler();

        const result = await handler(undefined, {
            ...CONTEXT,
            mergeSourceProof: "stored-source-proof",
        } as Parameters<ReturnType<typeof createGetMergeTokenHandler>>[1]);

        expect(result).toBe("tok");
        expect(mockInitiatePost).toHaveBeenCalledWith({
            sourceAnonymousId: "client-1",
            merchantId: "merchant-1",
            proof: "stored-source-proof",
        });
        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("prefers the RPC param over the stored proof", async () => {
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "tok" } });
        const handler = createGetMergeTokenHandler();

        await handler(["fresh-rpc-proof"], {
            ...CONTEXT,
            mergeSourceProof: "stored-source-proof",
        } as Parameters<ReturnType<typeof createGetMergeTokenHandler>>[1]);

        expect(mockInitiatePost).toHaveBeenCalledWith(
            expect.objectContaining({ proof: "fresh-rpc-proof" })
        );
    });

    test("counts a proofless call and refuses it", async () => {
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "tok" } });
        const handler = createGetMergeTokenHandler();

        const result = await handler(undefined, CONTEXT);

        expect(mockTrackEvent).toHaveBeenCalledExactlyOnceWith(
            "merge_initiate_proofless"
        );
        expect(mockInitiatePost).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });

    test("does not count when merchantId or clientId is missing", async () => {
        const handler = createGetMergeTokenHandler();

        await handler(undefined, {
            merchantId: undefined,
            clientId: "client-1",
        } as unknown as Parameters<
            ReturnType<typeof createGetMergeTokenHandler>
        >[1]);

        expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("returns null when merchantId or clientId is missing", async () => {
        const handler = createGetMergeTokenHandler();

        const result = await handler(["the-proof"], {
            merchantId: undefined,
            clientId: "client-1",
        } as unknown as Parameters<
            ReturnType<typeof createGetMergeTokenHandler>
        >[1]);

        expect(result).toBeNull();
        expect(mockInitiatePost).not.toHaveBeenCalled();
    });

    test("returns null when backend response has no mergeToken", async () => {
        mockInitiatePost.mockResolvedValue({ data: null });
        const handler = createGetMergeTokenHandler();

        const result = await handler(undefined, CONTEXT);

        expect(result).toBeNull();
    });
});
