import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockInitiatePost = vi.fn();

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
    });

    test("sends proof: undefined (no explicit value) when params are absent, matching legacy SDK behaviour", async () => {
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "tok" } });
        const handler = createGetMergeTokenHandler();

        const result = await handler(undefined, CONTEXT);

        expect(result).toBe("tok");
        const body = mockInitiatePost.mock.calls[0][0];
        expect(body).toEqual({
            sourceAnonymousId: "client-1",
            merchantId: "merchant-1",
            proof: undefined,
        });
        // undefined-valued keys serialise identically to omitted keys.
        expect(JSON.stringify(body)).toBe(
            JSON.stringify({
                sourceAnonymousId: "client-1",
                merchantId: "merchant-1",
            })
        );
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
