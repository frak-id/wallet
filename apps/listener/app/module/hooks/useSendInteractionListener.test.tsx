import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { resolvingContextStore } from "../stores/resolvingContextStore";
import { useSendInteractionListener } from "./useSendInteractionListener";

const { mockTrackInteractionPost } = vi.hoisted(() => ({
    mockTrackInteractionPost: vi.fn(),
}));
const { mockSetClientId } = vi.hoisted(() => ({
    mockSetClientId: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared", () => ({
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
    clientIdStore: {
        getState: () => ({
            setClientId: mockSetClientId,
        }),
    },
}));

describe("useSendInteractionListener", () => {
    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
        resolvingContextStore.setState({ context: undefined });
    });

    test("should submit interaction from rpc context when trust level is verified", async ({
        queryWrapper,
    }) => {
        mockTrackInteractionPost.mockResolvedValue({
            data: { success: true },
            error: null,
        });

        resolvingContextStore.setState({ trustLevel: "verified" });

        const { result } = renderHook(() => useSendInteractionListener(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current([{ type: "sharing" }], {
            origin: "https://example.com",
            source: null,
            merchantId: "merchant-id",
            sourceUrl: "https://example.com/article",
            clientId: "client-id",
        });

        await waitFor(() => {
            expect(mockTrackInteractionPost).toHaveBeenCalledWith({
                type: "sharing",
                merchantId: "merchant-id",
            });
        });
        expect(mockSetClientId).toHaveBeenCalledWith("client-id");
    });
});
