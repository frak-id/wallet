import type { RpcClient } from "@frak-labs/frame-connector";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "../../tests/vitest-fixtures";
import type { FrakLifecycleEvent, FrakWalletSdkConfig } from "../types";
import type { IFrameRpcSchema } from "../types/rpc";
import { setupMobileAuthCallback } from "./mobileAuthCallback";

describe("setupMobileAuthCallback", () => {
    let mockRpcClient: RpcClient<IFrameRpcSchema, FrakLifecycleEvent>;
    let mockConfig: FrakWalletSdkConfig;
    let originalLocation: Location;
    let originalHistory: History;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    const mockAuthCode = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockPayload";
    const mockProductId = "0x1234567890abcdef";
    const mockState = "random-state-123";
    const mockWallet = "0xabcdef1234567890abcdef1234567890abcdef12";
    const mockSdkJwt = { token: "jwt-token", expires: 1234567890 };

    beforeEach(() => {
        // Save original values
        originalLocation = window.location;
        originalHistory = window.history;

        // Mock RPC client
        mockRpcClient = {
            sendLifecycle: vi.fn(),
        } as any;

        // Mock config
        mockConfig = {
            walletUrl: "https://wallet.frak.id",
            metadata: { name: "Test App" },
        };

        // Mock console methods
        consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        // Mock history.replaceState
        window.history.replaceState = vi.fn();

        // Clear sessionStorage
        sessionStorage.clear();

        // Mock fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({ wallet: mockWallet, sdkJwt: mockSdkJwt }),
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        consoleErrorSpy.mockRestore();
        sessionStorage.clear();

        // Restore original values
        Object.defineProperty(window, "location", {
            value: originalLocation,
            writable: true,
        });
        Object.defineProperty(window, "history", {
            value: originalHistory,
            writable: true,
        });
    });

    it("should do nothing when window is undefined", () => {
        const originalWindow = global.window;
        // @ts-expect-error - intentionally removing window for test
        delete global.window;

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();

        // Restore window
        global.window = originalWindow;
    });

    it("should do nothing when no frakAuth parameter in URL", () => {
        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/test",
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();
        expect(window.history.replaceState).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should do nothing when no productId parameter in URL", () => {
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        expect(mockRpcClient.sendLifecycle).not.toHaveBeenCalled();
        expect(window.history.replaceState).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should reject when state does not match saved state", () => {
        // Set saved state in sessionStorage
        sessionStorage.setItem("frak_auth_state", mockState);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}&productId=${mockProductId}&state=wrong-state`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "[Frak SDK] Mobile auth callback state mismatch"
        );
        expect(global.fetch).not.toHaveBeenCalled();
        // URL should still be cleaned
        expect(window.history.replaceState).toHaveBeenCalled();
    });

    it("should initiate exchange when valid params are present", () => {
        // Set saved state
        sessionStorage.setItem("frak_auth_state", mockState);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}&productId=${mockProductId}&state=${mockState}`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        // Verify fetch was called immediately to exchange the code
        expect(global.fetch).toHaveBeenCalled();

        // Verify URL was cleaned
        expect(window.history.replaceState).toHaveBeenCalled();
    });

    it("should clean URL immediately after detecting auth params", () => {
        sessionStorage.setItem("frak_auth_state", mockState);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}&productId=${mockProductId}&state=${mockState}`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        // URL should be cleaned immediately
        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/test"
        );
    });

    it("should call fetch with correct parameters", () => {
        sessionStorage.setItem("frak_auth_state", mockState);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}&productId=${mockProductId}&state=${mockState}`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        // Verify fetch was called with correct URL and body
        expect(global.fetch).toHaveBeenCalledWith(
            "https://wallet.frak.id/api/wallet/auth/mobile/exchange",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    authCode: mockAuthCode,
                    productId: mockProductId,
                }),
            }
        );
    });

    it("should preserve other URL parameters when cleaning", () => {
        sessionStorage.setItem("frak_auth_state", mockState);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?other=param&frakAuth=${mockAuthCode}&productId=${mockProductId}&state=${mockState}&another=value`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        expect(window.history.replaceState).toHaveBeenCalledWith(
            {},
            "",
            "https://example.com/test?other=param&another=value"
        );
    });

    it("should use default walletUrl when not provided in config", () => {
        sessionStorage.setItem("frak_auth_state", mockState);

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}&productId=${mockProductId}&state=${mockState}`,
            },
            writable: true,
        });

        const configWithoutUrl: FrakWalletSdkConfig = {
            metadata: { name: "Test App" },
        };

        setupMobileAuthCallback(
            configWithoutUrl,
            mockRpcClient,
            Promise.resolve(true)
        );

        // Default URL should be used
        expect(global.fetch).toHaveBeenCalledWith(
            "https://wallet.frak.id/api/wallet/auth/mobile/exchange",
            expect.any(Object)
        );
    });

    it("should work without state parameter when no saved state", () => {
        // Don't set any state in sessionStorage

        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/test?frakAuth=${mockAuthCode}&productId=${mockProductId}`,
            },
            writable: true,
        });

        setupMobileAuthCallback(
            mockConfig,
            mockRpcClient,
            Promise.resolve(true)
        );

        // Should still call fetch without state (no CSRF check when no state)
        expect(global.fetch).toHaveBeenCalled();
    });
});
