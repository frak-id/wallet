/**
 * Tests for prepareSso action
 * Tests SSO URL generation via RPC
 */

import { describe, expect, it, vi } from "../../tests/vitest-fixtures";
import type {
    FrakClient,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
} from "../types";
import { prepareSso } from "./prepareSso";

describe("prepareSso", () => {
    describe("success cases", () => {
        it("should call client.request with correct method and params", async () => {
            const mockResponse: PrepareSsoReturnType = {
                ssoUrl: "https://wallet.frak.id/sso?params=xyz",
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {
                directExit: true,
            };

            await prepareSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_prepareSso",
                params: [params, "Test App", undefined],
            });
        });

        it("should return SSO URL", async () => {
            const mockResponse: PrepareSsoReturnType = {
                ssoUrl: "https://wallet.frak.id/sso?params=abc123",
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {
                directExit: false,
            };

            const result = await prepareSso(mockClient, params);

            expect(result).toEqual(mockResponse);
            expect(result.ssoUrl).toBe(
                "https://wallet.frak.id/sso?params=abc123"
            );
        });

        it("should include custom CSS when provided", async () => {
            const mockResponse: PrepareSsoReturnType = {
                ssoUrl: "https://wallet.frak.id/sso?params=custom",
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Styled App",
                    },
                    customizations: {
                        css: "body { background: red; }",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {
                directExit: true,
            };

            await prepareSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_prepareSso",
                params: [params, "Styled App", "body { background: red; }"],
            });
        });

        it("should handle params with redirectUrl", async () => {
            const mockResponse: PrepareSsoReturnType = {
                ssoUrl: "https://wallet.frak.id/sso?redirect=https://example.com",
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {
                redirectUrl: "https://example.com/callback",
                directExit: false,
            };

            await prepareSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_prepareSso",
                params: [params, "Test App", undefined],
            });
        });

        it("should handle params with metadata", async () => {
            const mockResponse: PrepareSsoReturnType = {
                ssoUrl: "https://wallet.frak.id/sso?metadata=xyz",
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "App with Metadata",
                        logoUrl: "https://example.com/logo.png",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {
                metadata: {
                    logoUrl: "https://custom.com/logo.png",
                    homepageLink: "https://custom.com",
                },
                directExit: true,
            };

            await prepareSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_prepareSso",
                params: [params, "App with Metadata", undefined],
            });
        });

        it("should pass client metadata name to request", async () => {
            const mockResponse: PrepareSsoReturnType = {
                ssoUrl: "https://wallet.frak.id/sso?name=MyApp",
            };

            const mockClient = {
                config: {
                    metadata: {
                        name: "MyApp",
                        logoUrl: "https://example.com/logo.png",
                    },
                    customizations: {
                        css: "body { color: blue; }",
                    },
                },
                request: vi.fn().mockResolvedValue(mockResponse),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {};

            await prepareSso(mockClient, params);

            expect(mockClient.request).toHaveBeenCalledWith({
                method: "frak_prepareSso",
                params: [params, "MyApp", "body { color: blue; }"],
            });
        });
    });

    describe("error handling", () => {
        it("should propagate errors from client.request", async () => {
            const error = new Error("SSO preparation failed");
            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {
                directExit: true,
            };

            await expect(prepareSso(mockClient, params)).rejects.toThrow(
                "SSO preparation failed"
            );
        });

        it("should handle network errors", async () => {
            const error = new Error("Network timeout");
            const mockClient = {
                config: {
                    metadata: {
                        name: "Test App",
                    },
                },
                request: vi.fn().mockRejectedValue(error),
            } as unknown as FrakClient;

            const params: PrepareSsoParamsType = {};

            await expect(prepareSso(mockClient, params)).rejects.toThrow(
                "Network timeout"
            );
        });
    });
});
