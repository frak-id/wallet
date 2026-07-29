/** @jsxImportSource react */
import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";

const platformMocks = vi.hoisted(() => ({
    isAndroid: vi.fn(() => true),
    isTauri: vi.fn(() => true),
}));
vi.mock("@frak-labs/app-essentials/utils/platform", async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import("@frak-labs/app-essentials/utils/platform")
        >();
    return {
        ...actual,
        get IS_ANDROID() {
            return platformMocks.isAndroid();
        },
        get IS_TAURI() {
            return platformMocks.isTauri();
        },
    };
});

const mockGetInstallReferrer = vi.hoisted(() => vi.fn());
vi.mock("../utils/installReferrer", () => ({
    getInstallReferrer: mockGetInstallReferrer,
}));

const mockMerchantResolveGet = vi.hoisted(() => vi.fn());
const mockSetClientId = vi.hoisted(() => vi.fn());
const clientIdStoreState = vi.hoisted(() => ({
    clientId: undefined as string | undefined,
}));
vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...actual,
        trackEvent: vi.fn(),
        setInstallSource: vi.fn(),
        authenticatedBackendApi: {
            user: {
                merchant: {
                    resolve: {
                        get: mockMerchantResolveGet,
                    },
                },
            },
        },
        clientIdStore: {
            getState: () => ({
                clientId: clientIdStoreState.clientId,
                setClientId: (id: string) => {
                    mockSetClientId(id);
                    clientIdStoreState.clientId = id;
                },
            }),
        },
    };
});

const merchant = { name: "Acme", domain: "acme.example" };

describe("useInstallReferrer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        platformMocks.isAndroid.mockReturnValue(true);
        platformMocks.isTauri.mockReturnValue(true);
        mockMerchantResolveGet.mockResolvedValue({
            data: merchant,
            error: null,
        });
        pendingActionsStore.getState().clearAll();
        clientIdStoreState.clientId = undefined;
    });

    afterEach(() => {
        pendingActionsStore.getState().clearAll();
    });

    test("dual arm: parses merchantId/anonymousId/proof and carries all three onto the pending action", async ({
        queryWrapper,
    }) => {
        mockGetInstallReferrer.mockResolvedValue({
            referrer:
                "merchantId=merchant-1&anonymousId=anon-1&proof=install-proof-blob",
            clickTimestamp: 0,
            installTimestamp: 0,
        });

        const { useInstallReferrer } = await import("./useInstallReferrer");
        const { result } = renderHook(() => useInstallReferrer(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toMatchObject({
            merchantId: "merchant-1",
            anonymousId: "anon-1",
            proof: "install-proof-blob",
        });

        const [action] = pendingActionsStore.getState().getValidActions();
        expect(action?.type).toBe("ensure");
        if (action?.type === "ensure") {
            expect(action.merchantId).toBe("merchant-1");
            expect(action.anonymousId).toBe("anon-1");
            expect(action.proof).toBe("install-proof-blob");
        }

        expect(mockSetClientId).toHaveBeenCalledWith("anon-1");
    });

    test("legacy pair only: a referrer string with no proof= key still resolves (proof stays absent, not an error)", async ({
        queryWrapper,
    }) => {
        // Literal string a pre-W3 producer (old wallet build's own sharing
        // page, or an old SDK-driven install link) would still emit —
        // asserts the parser degrades gracefully rather than requiring the
        // new key.
        mockGetInstallReferrer.mockResolvedValue({
            referrer: "merchantId=merchant-2&anonymousId=anon-2",
            clickTimestamp: 0,
            installTimestamp: 0,
        });

        const { useInstallReferrer } = await import("./useInstallReferrer");
        const { result } = renderHook(() => useInstallReferrer(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toMatchObject({
            merchantId: "merchant-2",
            anonymousId: "anon-2",
            proof: undefined,
        });

        const [action] = pendingActionsStore.getState().getValidActions();
        expect(action?.type).toBe("ensure");
        if (action?.type === "ensure") {
            expect(action.proof).toBeUndefined();
        }
    });

    test("missing merchantId/anonymousId still returns null regardless of a proof key being present", async ({
        queryWrapper,
    }) => {
        mockGetInstallReferrer.mockResolvedValue({
            referrer: "proof=install-proof-blob",
            clickTimestamp: 0,
            installTimestamp: 0,
        });

        const { useInstallReferrer } = await import("./useInstallReferrer");
        const { result } = renderHook(() => useInstallReferrer(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toBeNull();
        expect(pendingActionsStore.getState().getValidActions()).toHaveLength(
            0
        );
    });
});
