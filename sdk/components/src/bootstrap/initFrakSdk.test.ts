import * as coreSdkIndex from "@frak-labs/core-sdk";
import { compressJsonToB64 } from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sharingPageUtils from "../actions/sharingPage";
import * as clientReadyUtils from "./clientReady";
import { initFrakSdk } from "./initFrakSdk";

const openPanelTrack = vi.hoisted(() => vi.fn());

// Mock dependencies — pass through withCache/clearAllCache so the real cache works
vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        setupClient: vi.fn(),
        trackEvent: vi.fn(),
        createSdkOpenPanel: vi.fn(() => ({ track: openPanelTrack })),
    };
});

vi.mock("@frak-labs/core-sdk/actions", () => ({
    displayModal: vi.fn(),
    setupReferral: vi.fn(),
}));

vi.mock("./clientReady", () => ({
    dispatchClientReadyEvent: vi.fn(),
}));

vi.mock("../actions/sharingPage", () => ({
    openSharingPage: vi.fn(),
}));

// Tests mutate window.FrakSetup and vi.mock module state, so they depend on
// the workspace's in-file sequential execution.
describe("initFrakSdk", () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        // Clear withCache global state between tests
        const { clearAllCache } = await import("@frak-labs/core-sdk");
        clearAllCache();
        // Reset window state
        window.FrakSetup = {
            config: {
                domain: "example.com",
            },
            client: undefined,
            core: undefined,
        } as any;
        // Reset URL search params
        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/",
            },
            writable: true,
        });
        // Spy on history.replaceState so we can assert URL cleanup
        window.history.replaceState = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("sdk_init_failed", () => {
        beforeEach(async () => {
            const actual = await vi.importActual<
                typeof import("@frak-labs/core-sdk")
            >("@frak-labs/core-sdk");
            vi.mocked(coreSdkIndex.trackEvent).mockImplementation(
                actual.trackEvent
            );
        });

        const initFailedCalls = () =>
            openPanelTrack.mock.calls.filter(
                ([event]) => event === "sdk_init_failed"
            );

        it("reaches OpenPanel when the config is missing", async () => {
            window.FrakSetup.config = undefined;
            Object.defineProperty(window, "location", {
                value: { href: "https://shop.test/", hostname: "shop.test" },
                writable: true,
            });

            await initFrakSdk();
            await vi.waitFor(() => expect(initFailedCalls()).toHaveLength(1));

            expect(initFailedCalls()[0][1]).toEqual({
                reason: "config_missing",
                config_missing: true,
                domain: "shop.test",
            });
        });

        it("reaches OpenPanel when no client could be created", async () => {
            vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(undefined);

            await initFrakSdk();
            await vi.waitFor(() => expect(initFailedCalls()).toHaveLength(1));

            expect(initFailedCalls()[0][1]).toEqual({
                reason: "client_unavailable",
                config_missing: false,
                domain: "example.com",
            });
        });

        it("names the error when client setup throws", async () => {
            vi.mocked(coreSdkIndex.setupClient).mockRejectedValue(
                new TypeError("[Frak] iframe blocked")
            );

            await initFrakSdk();
            await vi.waitFor(() => expect(initFailedCalls()).toHaveLength(1));

            expect(initFailedCalls()[0][1]).toMatchObject({
                reason: "TypeError",
            });
        });

        it("sends the RPC code when client setup throws a FrakRpcError", async () => {
            vi.mocked(coreSdkIndex.setupClient).mockRejectedValue(
                new FrakRpcError(
                    RpcErrorCodes.configError,
                    "The iframe does not have a content window"
                )
            );

            await initFrakSdk();
            await vi.waitFor(() => expect(initFailedCalls()).toHaveLength(1));

            expect(initFailedCalls()[0][1]).toMatchObject({
                reason: "rpc_-32002",
            });
        });

        it("is sent once per failed attempt, not once per caller", async () => {
            vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(undefined);

            await Promise.all([initFrakSdk(), initFrakSdk(), initFrakSdk()]);
            // Inside the 1 s backoff: rejected by the cache, never attempted.
            await initFrakSdk();
            await vi.waitFor(() => expect(initFailedCalls()).toHaveLength(1));
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(initFailedCalls()).toHaveLength(1);
        });
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
            config: {
                ...window.FrakSetup.config,
                preload: [],
            },
        });
        expect(window.FrakSetup.client).toBe(mockClient);
        expect(clientReadyUtils.dispatchClientReadyEvent).toHaveBeenCalled();
        expect(coreSdkActions.setupReferral).toHaveBeenCalledWith(mockClient);

        consoleLogSpy.mockRestore();
    });

    it("should pass preload=['sharing'] when a Frak component is mounted", async () => {
        document.body.innerHTML = "<frak-button-share></frak-button-share>";

        const mockClient = { config: { domain: "example.com" } } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(coreSdkIndex.setupClient).toHaveBeenCalledWith({
            config: expect.objectContaining({ preload: ["sharing"] }),
        });

        document.body.innerHTML = "";
        consoleLogSpy.mockRestore();
    });

    it("should respect an explicit preload override (including empty array)", async () => {
        document.body.innerHTML = "<frak-button-share></frak-button-share>";
        window.FrakSetup.config = {
            ...window.FrakSetup.config,
            preload: [],
        } as any;

        const mockClient = { config: { domain: "example.com" } } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(coreSdkIndex.setupClient).toHaveBeenCalledWith({
            config: expect.objectContaining({ preload: [] }),
        });

        document.body.innerHTML = "";
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
                href: "https://example.com/?frakAction=share",
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "auto_open",
            undefined,
            undefined,
            { link: undefined, products: undefined }
        );
        // URL should be cleaned so a refresh does not re-trigger auto-open
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/"
        );

        consoleLogSpy.mockRestore();
    });

    it("should report sharing_page_auto_opened for a frakAction=share launch", async () => {
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue({
            config: { domain: "example.com" },
        } as any);
        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/?frakAction=share&placement=klaviyo&link=https%3A%2F%2Fexample.com%2Fa",
            },
            writable: true,
        });

        await initFrakSdk();

        expect(coreSdkIndex.trackEvent).toHaveBeenCalledWith(
            expect.anything(),
            "sharing_page_auto_opened",
            { placement: "klaviyo", has_link: true, has_products: false }
        );
    });

    it("should not report sharing_page_auto_opened without the query param", async () => {
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue({
            config: { domain: "example.com" },
        } as any);

        await initFrakSdk();

        expect(coreSdkIndex.trackEvent).not.toHaveBeenCalledWith(
            expect.anything(),
            "sharing_page_auto_opened",
            expect.anything()
        );
    });

    it("should forward link, placement and products query params to openSharingPage", async () => {
        const mockClient = {
            config: { domain: "example.com" },
        } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        const products = [
            { title: "Boots", link: "https://shop.example.com/boots" },
        ];
        const productsParam = compressJsonToB64(products);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/order/42?frakAction=share&link=https%3A%2F%2Fexample.com%2Forder%2F1&placement=klaviyo-post-purchase&products=${encodeURIComponent(productsParam)}&keep=me`,
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "auto_open",
            undefined,
            "klaviyo-post-purchase",
            {
                link: "https://example.com/order/1",
                products,
            }
        );
        // Only the four frak-managed params are stripped; unrelated query
        // params on the merchant URL (e.g. `keep=me`) survive.
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/order/42?keep=me"
        );

        consoleLogSpy.mockRestore();
    });

    it("should drop a malformed products param without crashing", async () => {
        const mockClient = {
            config: { domain: "example.com" },
        } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/?frakAction=share&products=$$$not-base64$$$",
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "auto_open",
            undefined,
            undefined,
            { link: undefined, products: undefined }
        );
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/"
        );

        consoleLogSpy.mockRestore();
    });

    it("should open sharing page when the frakAction key is lowercased", async () => {
        const mockClient = {
            config: { domain: "example.com" },
        } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/?frakaction=share",
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "auto_open",
            undefined,
            undefined,
            { link: undefined, products: undefined }
        );
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/"
        );

        consoleLogSpy.mockRestore();
    });

    it("should open sharing page when the frakAction value is uppercased", async () => {
        const mockClient = {
            config: { domain: "example.com" },
        } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/?frakAction=SHARE",
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "auto_open",
            undefined,
            undefined,
            { link: undefined, products: undefined }
        );

        consoleLogSpy.mockRestore();
    });

    it("should read companion params case-insensitively", async () => {
        const mockClient = {
            config: { domain: "example.com" },
        } as any;
        vi.mocked(coreSdkIndex.setupClient).mockResolvedValue(mockClient);

        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/?FrakAction=Share&LINK=https%3A%2F%2Fexample.com%2Forder%2F1&Placement=hero",
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "auto_open",
            undefined,
            "hero",
            { link: "https://example.com/order/1", products: undefined }
        );
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/"
        );

        consoleLogSpy.mockRestore();
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
                href: "https://example.com/?frakAction=other",
            },
            writable: true,
        });

        await initFrakSdk();

        expect(sharingPageUtils.openSharingPage).not.toHaveBeenCalled();
        // No share intent means we never touch the URL either
        expect(window.history.replaceState).not.toHaveBeenCalled();
    });
});
