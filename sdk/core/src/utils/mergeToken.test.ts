import { afterEach, beforeEach, describe, expect, it, vi } from "../../tests/vitest-fixtures";
import type { FrakWalletSdkConfig } from "../types/config";
import * as clientIdModule from "./clientId";
import * as merchantIdModule from "./merchantId";
import * as backendUrlModule from "./backendUrl";
import {
    generateMergeToken,
    redirectWithMerge,
    setupMergeTokenListener,
} from "./mergeToken";

describe("mergeToken", () => {
    const mockConfig: FrakWalletSdkConfig = {
        metadata: {
            name: "Test App",
        },
    };

    let originalWindow: typeof globalThis.window;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        originalWindow = globalThis.window;
        originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn();

        // Mock module functions
        vi.spyOn(clientIdModule, "getClientId").mockReturnValue("test-client-id");
        vi.spyOn(merchantIdModule, "resolveMerchantId").mockResolvedValue("test-merchant-id");
        vi.spyOn(backendUrlModule, "getBackendUrl").mockReturnValue("https://backend.test");
    });

    afterEach(() => {
        globalThis.window = originalWindow;
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    describe("generateMergeToken", () => {
        it("should return undefined in SSR environment", async () => {
            // @ts-expect-error - Simulating SSR
            delete globalThis.window;

            const result = await generateMergeToken(mockConfig);
            expect(result).toBeUndefined();
        });

        it("should generate merge token successfully", async () => {
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    mergeToken: "test-token",
                    expiresAt: "2026-01-16T13:00:00Z",
                }),
            });

            const result = await generateMergeToken(mockConfig);

            expect(result).toBe("test-token");
            expect(globalThis.fetch).toHaveBeenCalledWith(
                "https://backend.test/user/identity/merge/initiate",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sourceAnonymousId: "test-client-id",
                        merchantId: "test-merchant-id",
                    }),
                }
            );
        });

        it("should return undefined when backend returns error", async () => {
            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: false,
                status: 400,
            });

            const result = await generateMergeToken(mockConfig);
            expect(result).toBeUndefined();
        });
    });

    describe("redirectWithMerge", () => {
        it("should not redirect in SSR environment", async () => {
            // @ts-expect-error - Simulating SSR
            delete globalThis.window;

            await redirectWithMerge("https://example.com", mockConfig);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it("should redirect with merge token appended", async () => {
            const mockAssign = vi.fn();
            globalThis.window = {
                location: { assign: mockAssign } as any,
            } as any;

            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    mergeToken: "test-token",
                    expiresAt: "2026-01-16T13:00:00Z",
                }),
            });

            await redirectWithMerge("https://example.com", mockConfig);

            expect(mockAssign).toHaveBeenCalledWith(
                "https://example.com/?fmt=test-token"
            );
        });

        it("should preserve existing query params", async () => {
            const mockAssign = vi.fn();
            globalThis.window = {
                location: { assign: mockAssign } as any,
            } as any;

            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    mergeToken: "test-token",
                    expiresAt: "2026-01-16T13:00:00Z",
                }),
            });

            await redirectWithMerge("https://example.com?foo=bar", mockConfig);

            expect(mockAssign).toHaveBeenCalledWith(
                "https://example.com/?foo=bar&fmt=test-token"
            );
        });
    });

    describe("setupMergeTokenListener", () => {
        it("should do nothing in SSR environment", () => {
            // @ts-expect-error - Simulating SSR
            delete globalThis.window;

            setupMergeTokenListener(mockConfig);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it("should do nothing when no fmt parameter present", () => {
            const mockReplaceState = vi.fn();
            globalThis.window = {
                location: { href: "https://example.com" } as any,
                history: { replaceState: mockReplaceState } as any,
            } as any;

            setupMergeTokenListener(mockConfig);

            expect(mockReplaceState).not.toHaveBeenCalled();
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it("should clean URL when fmt parameter present", () => {
            const mockReplaceState = vi.fn();
            globalThis.window = {
                location: { href: "https://example.com?fmt=test-token" } as any,
                history: { replaceState: mockReplaceState } as any,
            } as any;

            (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    finalGroupId: "group-123",
                    merged: true,
                }),
            });

            setupMergeTokenListener(mockConfig);

            // URL should be cleaned immediately
            expect(mockReplaceState).toHaveBeenCalledWith(
                {},
                "",
                "https://example.com/"
            );
        });
    });
});
