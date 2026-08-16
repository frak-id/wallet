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
): Promise<void> {
    const options = mergeTokenQueryOptions(args);
    await (options.queryFn as unknown as () => Promise<string | null>)();
}

describe("mergeTokenQueryOptions", () => {
    beforeEach(() => {
        mockTrackEvent.mockReset();
        mockInitiatePost.mockReset();
        mockInitiatePost.mockResolvedValue({ data: { mergeToken: "token" } });
    });

    it("counts the listener modal's proofless call", async () => {
        await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "listener_modal",
        });

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "merge_initiate_proofless",
            {
                source: "listener_modal",
            }
        );
    });

    it("counts the embedded wallet separately from the modal", async () => {
        await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "embedded_wallet",
        });

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

    it("does not count a wallet_explorer call that happens to carry an anonymous id", async () => {
        await runQuery({
            merchantId: MERCHANT,
            sourceAnonymousId: "anon-1",
            source: "wallet_explorer",
        });

        expect(mockTrackEvent).not.toHaveBeenCalled();
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
