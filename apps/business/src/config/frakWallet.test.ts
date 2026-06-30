import { describe, expect, test, vi } from "vitest";

// Mock app-essentials before importing config
vi.mock("@frak-labs/app-essentials", () => ({
    isRunningLocally: false,
}));

describe("frakWalletSdkConfig", () => {
    test("should export frakWalletSdkConfig object", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        expect(frakWalletSdkConfig).toBeDefined();
        expect(typeof frakWalletSdkConfig).toBe("object");
    });

    test("should have walletUrl property", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        expect(frakWalletSdkConfig).toHaveProperty("walletUrl");
        expect(typeof frakWalletSdkConfig.walletUrl).toBe("string");
    });

    test("should have metadata with name", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        expect(frakWalletSdkConfig).toHaveProperty("metadata");
        expect(frakWalletSdkConfig.metadata).toEqual({
            name: "Dashboard",
        });
    });

    test("should have customizations with i18n", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        expect(frakWalletSdkConfig).toHaveProperty("customizations");
        expect(frakWalletSdkConfig.customizations).toHaveProperty("i18n");
        expect(typeof frakWalletSdkConfig.customizations?.i18n).toBe("object");
    });

    test("should set the dashboard modal i18n copy", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        const i18n = frakWalletSdkConfig.customizations?.i18n as {
            fr: Record<string, string>;
        };
        expect(i18n.fr["sdk.modal.login.title"]).toBe(
            "Connectez-vous à votre compte Frak"
        );
        expect(i18n.fr["sdk.modal.siweAuthenticate.title"]).toBe(
            "Connectez-vous à votre compte Frak"
        );
    });

    test("should use production wallet URL when not running locally", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        // When not running locally and no env var, should use production URL
        expect(frakWalletSdkConfig.walletUrl).toMatch(/https:\/\//);
    });
});
