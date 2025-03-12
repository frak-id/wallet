/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { FrakClient, OpenSsoParamsType } from "../types";
import { openSso } from "./openSso";

describe("openSso", () => {
    // Test data
    const mockMetadataName = "My App";
    const mockMetadataCss = { primary: "#123456" };
    const mockClientMetadata = {
        name: mockMetadataName,
        css: mockMetadataCss,
    };

    it("should call client request with correct parameters for direct exit", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(undefined),
            config: {
                metadata: mockClientMetadata,
            },
        } as unknown as FrakClient;

        // SSO params with direct exit
        const ssoParams: OpenSsoParamsType = {
            directExit: true,
            metadata: {
                logoUrl: "https://my-app.com/logo.png",
                homepageLink: "https://my-app.com",
            },
        };

        // Execute
        await openSso(mockClient, ssoParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_sso",
            params: [ssoParams, mockMetadataName, mockMetadataCss],
        });
    });

    it("should call client request with correct parameters for redirection", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(undefined),
            config: {
                metadata: mockClientMetadata,
            },
        } as unknown as FrakClient;

        // SSO params with redirect URL
        const ssoParams: OpenSsoParamsType = {
            redirectUrl: "https://my-app.com/nexus-sso",
            metadata: {
                logoUrl: "https://my-app.com/logo.png",
                homepageLink: "https://my-app.com",
            },
        };

        // Execute
        await openSso(mockClient, ssoParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_sso",
            params: [ssoParams, mockMetadataName, mockMetadataCss],
        });
    });

    it("should forward client errors", async () => {
        // Mock error
        const mockError = new Error("RPC error");

        // Mock client with error
        const mockClient: FrakClient = {
            request: vi.fn().mockRejectedValue(mockError),
            config: {
                metadata: mockClientMetadata,
            },
        } as unknown as FrakClient;

        // SSO params
        const ssoParams: OpenSsoParamsType = {
            directExit: true,
            metadata: {
                logoUrl: "https://my-app.com/logo.png",
                homepageLink: "https://my-app.com",
            },
        };

        // Execute and verify error is thrown
        await expect(openSso(mockClient, ssoParams)).rejects.toThrow(mockError);
    });

    it("should work with minimal SSO params", async () => {
        // Mock client
        const mockClient: FrakClient = {
            request: vi.fn().mockResolvedValue(undefined),
            config: {
                metadata: mockClientMetadata,
            },
        } as unknown as FrakClient;

        // Minimal SSO params
        const ssoParams: OpenSsoParamsType = {
            directExit: true,
            metadata: {},
        };

        // Execute
        await openSso(mockClient, ssoParams);

        // Verify
        expect(mockClient.request).toHaveBeenCalledWith({
            method: "frak_sso",
            params: [ssoParams, mockMetadataName, mockMetadataCss],
        });
    });
});
