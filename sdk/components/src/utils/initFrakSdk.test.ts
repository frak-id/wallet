import * as coreSdkActions from "@frak-labs/core-sdk";
import * as coreSdk from "@frak-labs/core-sdk/bundle";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as buttonWalletUtils from "../components/ButtonWallet/utils";
import * as clientReadyUtils from "./clientReady";
import { initFrakSdk } from "./initFrakSdk";
import * as setupUtils from "./setup";

// Mock dependencies
vi.mock("@frak-labs/core-sdk/bundle", () => ({
    default: {},
}));

vi.mock("@frak-labs/core-sdk", () => ({
    setupClient: vi.fn(),
}));

vi.mock("./clientReady", () => ({
    dispatchClientReadyEvent: vi.fn(),
}));

vi.mock("./setup", () => ({
    setupModalConfig: vi.fn(),
    setupReferral: vi.fn(),
}));

vi.mock("../components/ButtonWallet/utils", () => ({
    openWalletModal: vi.fn(),
}));

describe("initFrakSdk", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset window state
        window.FrakSetup = {
            config: {
                domain: "example.com",
                walletUrl: "https://wallet.frak.id",
            },
            client: undefined,
            core: undefined,
        } as any;
        window.frakSetupInProgress = false;
        // Reset URL search params
        Object.defineProperty(window, "location", {
            value: {
                search: "",
            },
            writable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should export core SDK to window.FrakSetup.core", async () => {
        await initFrakSdk();

        expect(window.FrakSetup.core).toBe(coreSdk);
    });

    it("should not initialize if setup is already in progress", async () => {
        window.frakSetupInProgress = true;

        await initFrakSdk();

        expect(coreSdkActions.setupClient).not.toHaveBeenCalled();
    });

    it("should not initialize if client already exists", async () => {
        window.FrakSetup.client = {
            config: {},
        } as any;

        await initFrakSdk();

        expect(coreSdkActions.setupClient).not.toHaveBeenCalled();
    });

    it("should not initialize if config is missing", async () => {
        window.FrakSetup.config = undefined;

        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(coreSdkActions.setupClient).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "[Frak SDK] Configuration not found. Please ensure window.FrakSetup.config is set."
        );
        expect(window.frakSetupInProgress).toBe(false);

        consoleErrorSpy.mockRestore();
    });

    it("should initialize client successfully", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkActions.setupClient).mockResolvedValue(mockClient);

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(coreSdkActions.setupClient).toHaveBeenCalledWith({
            config: window.FrakSetup.config,
        });
        expect(window.FrakSetup.client).toBe(mockClient);
        expect(clientReadyUtils.dispatchClientReadyEvent).toHaveBeenCalled();
        expect(setupUtils.setupModalConfig).toHaveBeenCalledWith(mockClient);
        expect(setupUtils.setupReferral).toHaveBeenCalledWith(mockClient);
        expect(window.frakSetupInProgress).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[Frak SDK] Starting initialization"
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[Frak SDK] Client initialized successfully"
        );

        consoleLogSpy.mockRestore();
    });

    it("should handle client creation failure", async () => {
        vi.mocked(coreSdkActions.setupClient).mockResolvedValue(undefined);

        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "[Frak SDK] Failed to create client"
        );
        expect(window.frakSetupInProgress).toBe(false);
        expect(window.FrakSetup.client).toBeUndefined();

        consoleErrorSpy.mockRestore();
    });

    it("should open wallet modal when frakAction=share query param is present", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkActions.setupClient).mockResolvedValue(mockClient);

        // Set up URL search params
        Object.defineProperty(window, "location", {
            value: {
                search: "?frakAction=share",
            },
            writable: true,
        });

        const consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

        await initFrakSdk();

        expect(buttonWalletUtils.openWalletModal).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(
            "[Frak SDK] Auto open query param found"
        );

        consoleLogSpy.mockRestore();
    });

    it("should not open wallet modal when frakAction query param is not present", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkActions.setupClient).mockResolvedValue(mockClient);

        await initFrakSdk();

        expect(buttonWalletUtils.openWalletModal).not.toHaveBeenCalled();
    });

    it("should not open wallet modal when frakAction has different value", async () => {
        const mockClient = {
            config: {
                domain: "example.com",
            },
        } as any;

        vi.mocked(coreSdkActions.setupClient).mockResolvedValue(mockClient);

        Object.defineProperty(window, "location", {
            value: {
                search: "?frakAction=other",
            },
            writable: true,
        });

        await initFrakSdk();

        expect(buttonWalletUtils.openWalletModal).not.toHaveBeenCalled();
    });
});
