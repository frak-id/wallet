import { describe, expect, test, vi } from "vitest";

// Mock app-essentials before importing config
vi.mock("@frak-labs/app-essentials", () => ({
    isRunningLocally: false,
}));

describe("frakWalletSdkConfig", () => {
    test("should export frakWalletSdkConfig object", async () => {
        const { frakWalletSdkConfig } = await import("./config");

        expect(frakWalletSdkConfig).toBeDefined();
        expect(typeof frakWalletSdkConfig).toBe("object");
    });

    test("should have walletUrl property", async () => {
        const { frakWalletSdkConfig } = await import("./config");

        expect(frakWalletSdkConfig).toHaveProperty("walletUrl");
        expect(typeof frakWalletSdkConfig.walletUrl).toBe("string");
    });

    test("should have metadata with name", async () => {
        const { frakWalletSdkConfig } = await import("./config");

        expect(frakWalletSdkConfig).toHaveProperty("metadata");
        expect(frakWalletSdkConfig.metadata).toEqual({
            name: "Dashboard",
        });
    });

    test("should have customizations with css", async () => {
        const { frakWalletSdkConfig } = await import("./config");

        expect(frakWalletSdkConfig).toHaveProperty("customizations");
        expect(frakWalletSdkConfig.customizations).toHaveProperty("css");
        expect(typeof frakWalletSdkConfig.customizations?.css).toBe("string");
    });

    test("should use production wallet URL when not running locally", async () => {
        const { frakWalletSdkConfig } = await import("./config");

        // When not running locally and no env var, should use production URL
        expect(frakWalletSdkConfig.walletUrl).toMatch(/https:\/\//);
    });

    test("should use production CSS URL when not running locally", async () => {
        const { frakWalletSdkConfig } = await import("./config");

        expect(frakWalletSdkConfig.customizations?.css).toContain(
            "business-dev.frak.id"
        );
    });
});
