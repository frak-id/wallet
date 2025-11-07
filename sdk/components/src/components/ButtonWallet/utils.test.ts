import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as safeVibrateUtils from "@/utils/safeVibrate";
import { openWalletModal } from "./utils";

// Mock dependencies
vi.mock("@frak-labs/core-sdk/actions", () => ({
    displayEmbeddedWallet: vi.fn(),
}));

vi.mock("@/utils/safeVibrate", () => ({
    safeVibrate: vi.fn(),
}));

describe("openWalletModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call safeVibrate and displayEmbeddedWallet when client exists", () => {
        openWalletModal();

        expect(safeVibrateUtils.safeVibrate).toHaveBeenCalledTimes(1);
        expect(coreSdkActions.displayEmbeddedWallet).toHaveBeenCalledWith(
            window.FrakSetup.client,
            window.FrakSetup.modalWalletConfig ?? {}
        );
    });

    it("should not call displayEmbeddedWallet when client does not exist", () => {
        const originalClient = window.FrakSetup.client;
        window.FrakSetup.client = undefined;

        openWalletModal();

        expect(safeVibrateUtils.safeVibrate).not.toHaveBeenCalled();
        expect(coreSdkActions.displayEmbeddedWallet).not.toHaveBeenCalled();

        // Restore client
        window.FrakSetup.client = originalClient;
    });

    it("should use modalWalletConfig when provided", () => {
        const customConfig = { metadata: { position: "left" } };
        window.FrakSetup.modalWalletConfig = customConfig;

        openWalletModal();

        expect(coreSdkActions.displayEmbeddedWallet).toHaveBeenCalledWith(
            window.FrakSetup.client,
            customConfig
        );
    });

    it("should use empty object when modalWalletConfig is not provided", () => {
        const originalConfig = window.FrakSetup.modalWalletConfig;
        window.FrakSetup.modalWalletConfig = undefined;

        openWalletModal();

        expect(coreSdkActions.displayEmbeddedWallet).toHaveBeenCalledWith(
            window.FrakSetup.client,
            {}
        );

        // Restore config
        window.FrakSetup.modalWalletConfig = originalConfig;
    });
});
