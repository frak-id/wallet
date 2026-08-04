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

    test("should have an env property", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        expect(frakWalletSdkConfig).toHaveProperty("env");
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

    test("should use the production stage when nothing is injected", async () => {
        vi.stubEnv("FRAK_WALLET_URL", "");
        vi.stubEnv("BACKEND_URL", "");
        vi.resetModules();

        // Falls back to the named preset, not a hardcoded pair that could drift from the SDK's.
        const { frakWalletSdkConfig } = await import("./frakWallet");
        expect(frakWalletSdkConfig.env).toBe("prod");

        vi.unstubAllEnvs();
    });

    test("should pair the injected origins when both are present", async () => {
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet.sandbox.frak.id");
        vi.stubEnv("BACKEND_URL", "https://backend.sandbox.frak.id");
        vi.resetModules();

        const { frakWalletSdkConfig } = await import("./frakWallet");
        expect(frakWalletSdkConfig.env).toEqual({
            wallet: "https://wallet.sandbox.frak.id",
            backend: "https://backend.sandbox.frak.id",
        });

        vi.unstubAllEnvs();
    });
});
