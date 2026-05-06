import * as coreSdkIndex from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as clientReadyUtils from "./clientReady";
import { initFrakSdk } from "./initFrakSdk";
import * as sharingPageUtils from "./sharingPage";
import { buildShareLinkUrl, type ShareLinkPayload } from "./shareLink";

// Mock dependencies — pass through withCache/clearAllCache so the real cache works
vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        setupClient: vi.fn(),
    };
});

vi.mock("@frak-labs/core-sdk/actions", () => ({
    displayModal: vi.fn(),
    setupReferral: vi.fn(),
}));

vi.mock("./clientReady", () => ({
    dispatchClientReadyEvent: vi.fn(),
}));

vi.mock("./sharingPage", () => ({
    openSharingPage: vi.fn(),
}));

// Sequential: tests mutate window.FrakSetup and vi.mock module state,
// incompatible with the workspace default of `sequence.concurrent: true`.
describe.sequential("initFrakSdk", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Clear withCache global state between tests
        const { clearAllCache } = await import("@frak-labs/core-sdk");
        clearAllCache();
        // Reset window state
        window.FrakSetup = {
            config: {
                domain: "example.com",
                walletUrl: "https://wallet.frak.id",
            },
            client: undefined,
            core: undefined,
        } as any;
        // Reset URL search params
        Object.defineProperty(window, "location", {
            value: {
                search: "",
                href: "https://example.com/",
            },
            writable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should export core SDK to window.FrakSetup.core", async () => {
        await initFrakSdk();

        expect(window.FrakSetup.core).toEqual({
            ...coreSdkIndex,
            ...coreSdkActions,
        });
    });

    it("should deduplicate concurrent calls (only one setupClient call)", async () => {
        let resolveSetup: ((value: unknown) => void) | undefined;
        vi.mocked(coreSdkIndex.setupClient).mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveSetup = resolve;
                })
        );

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        // Fire 3 concurrent init calls
        const p1 = initFrakSdk();
        const p2 = initFrakSdk();
        const p3 = initFrakSdk();

        // Only one setupClient call should have been made
        expect(coreSdkIndex.setupClient).toHaveBeenCalledTimes(1);

        // Resolve the init
        resolveSetup?.({ config: { domain: "example.com" } });
        await Promise.all([p1, p2, p3]);

        // Still only one call
        expect(coreSdkIndex.setupClient).toHaveBeenCalledTimes(1);

        consoleLogSpy.mockRestore();
    });

    it("should not initialize if client already exists", async () => {
        window.FrakSetup.client = {
            config: {},
        } as any;

        await initFrakSdk();

        expect(coreSdkIndex.setupClient).not.toHaveBeenCalled();
    });

    it("should not initialize if config is missing", async () => {
        window.FrakSetup.config = undefined;

        await initFrakSdk();

        expect(coreSdkIndex.setupClient).not.toHaveBeenCalled();
    });

    it("should initialize client successfully", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(coreSdkIndex.setupClient).toHaveBeenCalledWith({
            config: window.FrakSetup.config,
        });
        expect(window.FrakSetup.client).toBe(mockClient);
        expect(clientReadyUtils.dispatchClientReadyEvent).toHaveBeenCalled();
        expect(coreSdkActions.setupReferral).toHaveBeenCalledWith(mockClient);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[Frak SDK] Starting initialization"
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[Frak SDK] Client initialized successfully"
        );

        consoleLogSpy.mockRestore();
    });

    it("should handle client creation failure", async () => {
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(undefined);

        await initFrakSdk();

        expect(window.FrakSetup.client).toBeUndefined();
    });

    it("should allow re-initialization after failure", async () => {
        vi.useFakeTimers();
        const mockClient = {
            config: { domain: "example.com" },
        } as any;

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        // First call fails
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValueOnce(undefined);

        await initFrakSdk();
        expect(window.FrakSetup.client).toBeUndefined();

        // Advance past the negative cache backoff (1s)
        vi.advanceTimersByTime(1_001);

        // Second call succeeds (withCache didn't cache the failure)
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValueOnce(mockClient);
        await initFrakSdk();
        expect(window.FrakSetup.client).toBe(mockClient);

        consoleLogSpy.mockRestore();
        vi.useRealTimers();
    });

    it("should open sharing page when frakAction=share query param is present", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        // Set up URL search params
        Object.defineProperty(window, "location", {
            value: {
                search: "?frakAction=share",
                href: "https://example.com/?frakAction=share",
            },
            writable: true,
        });

        const replaceStateSpy = vi
            .spyOn(window.history, "replaceState")
            .mockImplementation(() => {});

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[Frak SDK] Auto share trigger detected"
        );
        // URL is stripped of frakAction so refresh / back-nav doesn't re-fire
        expect(replaceStateSpy).toHaveBeenCalledWith(
            null,
            "",
            "https://example.com/"
        );

        consoleLogSpy.mockRestore();
        replaceStateSpy.mockRestore();
    });

    it("should decode frakData payload and forward it to openSharingPage", async () => {
        const mockClient = {
            config: { domain: "example.com" },
        } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        const payload: ShareLinkPayload = {
            link: "https://example.com/product/red",
            products: [{ title: "Red shirt" }],
            targetInteraction: "create_referral_link",
        };
        const shareUrl = buildShareLinkUrl({
            baseUrl: "https://example.com/",
            payload,
        });
        const parsedUrl = new URL(shareUrl);

        Object.defineProperty(window, "location", {
            value: { search: parsedUrl.search, href: shareUrl },
            writable: true,
        });

        const replaceStateSpy = vi
            .spyOn(window.history, "replaceState")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            payload.targetInteraction,
            undefined,
            { link: payload.link, products: payload.products }
        );
        // Both frakAction and frakData are stripped from the URL
        expect(replaceStateSpy).toHaveBeenCalledWith(
            null,
            "",
            "https://example.com/"
        );

        replaceStateSpy.mockRestore();
    });

    it("should not open sharing page when frakAction query param is not present", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).not.toHaveBeenCalled();
    });

    it("should not open sharing page when frakAction has different value", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        Object.defineProperty(window, "location", {
            value: {
                search: "?frakAction=other",
                href: "https://example.com/?frakAction=other",
            },
            writable: true,
        });

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).not.toHaveBeenCalled();
    });
});
