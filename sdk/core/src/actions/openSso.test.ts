/**
 * Tests for openSso action
 * Tests SSO flows in both redirect and popup modes
 */

import { vi } from "vitest";

// Mock utilities before imports
vi.mock("../utils/sso", () => ({
    generateSsoUrl: vi.fn((walletUrl, _args, productId, name, _css) => {
        return `${walletUrl}/sso?name=${name}&productId=${productId}`;
    }),
}));

vi.mock("../utils/computeProductId", () => ({
    computeProductId: vi.fn(
        () =>
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    ),
}));

import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "../../tests/vitest-fixtures";
import type {
    FrakClient,
    OpenSsoParamsType,
    OpenSsoReturnType,
} from "../types";
import { openSso, ssoPopupFeatures, ssoPopupName } from "./openSso";

describe("openSso", () => {
    describe("constants", () => {
        it("should have correct popup features", () => {
            expect(ssoPopupFeatures).toBe(
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
            );
        });

        it("should have correct popup name", () => {
            expect(ssoPopupName).toBe("frak-sso");
        });
    });

    describe("redirect mode", () => {
        it("should use redirect mode when openInSameWindow is true", async () => {
            const mockResponse: OpenSsoReturnType = {
                wallet: "0x1234567890123456789012345678901234567890",
            };

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                openInSameWindow: true,
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            const result = await openSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_openSso",
                params: [params, "Test App", undefined],
            });
            expect(result).toEqual(mockResponse);
        });

        it("should use redirect mode when redirectUrl is provided", async () => {
            const mockResponse: OpenSsoReturnType = {
                wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            };

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                redirectUrl: "https://example.com/callback",
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            const result = await openSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_openSso",
                params: [params, "Test App", undefined],
            });
            expect(result).toEqual(mockResponse);
        });

        it("should pass custom CSS in redirect mode", async () => {
            const mockResponse: OpenSsoReturnType = {};

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                    customizations: {
                        css: ":root { --primary: blue; }",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                openInSameWindow: true,
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            await openSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_openSso",
                params: [params, "Test App", ":root { --primary: blue; }"],
            });
        });
    });

    describe("popup mode", () => {
        let windowOpenSpy: any;
        let mockPopup: {
            focus: ReturnType<typeof vi.fn>;
        };

        beforeEach(() => {
            mockPopup = {
                focus: vi.fn(),
            };
            windowOpenSpy = vi
                .spyOn(window, "open")
                .mockReturnValue(mockPopup as unknown as Window);
        });

        afterEach(() => {
            windowOpenSpy.mockRestore();
        });

        it("should open popup with generated URL", async () => {
            const mockResponse: OpenSsoReturnType = {
                wallet: "0x1234567890123456789012345678901234567890",
            };

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                    walletUrl: "https://wallet.frak.id",
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            await openSso(mockClient, params);

            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining("https://wallet.frak.id/sso"),
                "frak-sso",
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
            );
        });

        it("should use custom ssoPopupUrl when provided", async () => {
            const mockResponse: OpenSsoReturnType = {};

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                ssoPopupUrl: "https://custom-wallet.com/sso?custom=param",
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            await openSso(mockClient, params);

            expect(window.open).toHaveBeenCalledWith(
                "https://custom-wallet.com/sso?custom=param",
                "frak-sso",
                "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800"
            );
        });

        it("should focus popup after opening", async () => {
            const mockResponse: OpenSsoReturnType = {};

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            await openSso(mockClient, params);

            expect(mockPopup.focus).toHaveBeenCalled();
        });

        it("should wait for SSO completion via client.request", async () => {
            const mockResponse: OpenSsoReturnType = {
                wallet: "0x1234567890123456789012345678901234567890",
            };

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            const result = await openSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_openSso",
                params: [params, "Test App", undefined],
            });
            expect(result).toEqual(mockResponse);
        });

        it("should return empty object when result is null", async () => {
            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(null),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            const result = await openSso(mockClient, params);

            expect(result).toEqual({});
        });

        it("should use default wallet URL when not configured", async () => {
            const mockResponse: OpenSsoReturnType = {};

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            await openSso(mockClient, params);

            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining("https://wallet.frak.id/sso"),
                expect.any(String),
                expect.any(String)
            );
        });
    });

    describe("popup blocker", () => {
        it("should throw error when popup is blocked", async () => {
            vi.spyOn(window, "open").mockReturnValue(null);

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn(),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            await expect(openSso(mockClient, params)).rejects.toThrow(
                "Popup was blocked. Please allow popups for this site."
            );
        });

        it("should not call client.request when popup is blocked", async () => {
            vi.spyOn(window, "open").mockReturnValue(null);

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn(),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            try {
                await openSso(mockClient, params);
            } catch {
                // Expected error
            }

            expect(mockClient.request).not.toHaveBeenCalled();
        });
    });

    describe("mode detection", () => {
        it("should prefer openInSameWindow over redirectUrl", async () => {
            const mockResponse: OpenSsoReturnType = {};

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                openInSameWindow: false,
                redirectUrl: "https://example.com/callback",
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue({
                focus: vi.fn(),
            } as unknown as Window);

            await openSso(mockClient, params);

            // Should use popup mode because openInSameWindow=false
            expect(window.open).toHaveBeenCalled();

            windowOpenSpy.mockRestore();
        });

        it("should use popup mode when neither flag is set", async () => {
            const mockResponse: OpenSsoReturnType = {};

            const mockClient = {
                config: {
                    metadata: { name: "Test App" },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: OpenSsoParamsType = {
                metadata: {
                    logoUrl: "https://example.com/logo.png",
                },
            };

            const windowOpenSpy = vi.spyOn(window, "open").mockReturnValue({
                focus: vi.fn(),
            } as unknown as Window);

            await openSso(mockClient, params);

            expect(window.open).toHaveBeenCalled();

            windowOpenSpy.mockRestore();
        });
    });
});
