import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { resolvingContextStore } from "../stores/resolvingContextStore";
import { createSendInteractionHandler } from "./useSendInteractionListener";

const { mockTrackInteractionPost } = vi.hoisted(() => ({
    mockTrackInteractionPost: vi.fn(),
}));
const { mockSetClientId } = vi.hoisted(() => ({
    mockSetClientId: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            merchant: {
                resolve: {
                    get: vi.fn().mockResolvedValue({
                        data: { merchantId: "merchant-id" },
                        error: null,
                    }),
                },
            },
            track: {
                interaction: {
                    post: mockTrackInteractionPost,
                },
            },
        },
    },
}));

vi.mock("@frak-labs/wallet-shared/stores/clientIdStore", () => ({
    clientIdStore: {
        getState: () => ({
            setClientId: mockSetClientId,
        }),
    },
}));

describe("createSendInteractionHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolvingContextStore.setState({ context: undefined });
    });

    test("should submit interaction from rpc context when trust level is verified", async () => {
        mockTrackInteractionPost.mockResolvedValue({
            data: { success: true },
            error: null,
        });

        const handler = createSendInteractionHandler({
            getTrustLevel: () => "verified",
        });

        await handler([{ type: "sharing" }], {
            origin: "https://example.com",
            source: null,
            merchantId: "merchant-id",
            sourceUrl: "https://example.com/article",
            clientId: "client-id",
        });

        // Microtask drain so the fire-and-forget sendInteraction settles.
        await Promise.resolve();
        await Promise.resolve();

        expect(mockTrackInteractionPost).toHaveBeenCalledWith({
            type: "sharing",
            merchantId: "merchant-id",
        });
        expect(mockSetClientId).toHaveBeenCalledWith("client-id");
    });
});
