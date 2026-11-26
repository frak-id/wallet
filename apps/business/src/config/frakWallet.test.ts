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
            en: Record<string, string>;
        };
        expect(i18n.fr["sdk.modal.login.title"]).toBe(
            "Connectez-vous ou créez votre compte"
        );
        expect(i18n.fr["sdk.modal.login.primaryAction"]).toBe("Continuer");
        expect(i18n.fr["sdk.modal.siweAuthenticate.title"]).toBe(
            "Confirmez que c'est vous"
        );
        expect(i18n.en["sdk.modal.login.title"]).toBe(
            "Log in or create your account"
        );
        expect(i18n.en["sdk.modal.login.primaryAction"]).toBe("Continue");
        expect(i18n.en["sdk.modal.siweAuthenticate.primaryAction"]).toBe(
            "Confirm"
        );
    });

    test("should not tell existing users to create an account", async () => {
        const { frakWalletSdkConfig } = await import("./frakWallet");

        const i18n = frakWalletSdkConfig.customizations?.i18n as Record<
            string,
            Record<string, string>
        >;
        expect(i18n.fr["sdk.modal.login.primaryAction"]).not.toMatch(/créer/i);
        expect(i18n.en["sdk.modal.login.primaryAction"]).not.toMatch(/create/i);
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
