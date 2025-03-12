import type { Address, Hex } from "viem";
/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrakClient, FrakContext } from "../../types";
import type { DisplayModalParamsType, ModalStepTypes } from "../../types";
import type { WalletStatusReturnType } from "../../types/rpc/walletStatus";

// Import the module to test
import { referralInteraction } from "./referralInteraction";

// Create mocks for dependencies
vi.mock("../../utils", () => ({
    FrakContextManager: {
        parse: vi.fn(),
    },
}));

vi.mock("../watchWalletStatus", () => ({
    watchWalletStatus: vi.fn(),
}));

vi.mock("./processReferral", () => ({
    processReferral: vi.fn(),
}));

describe("referralInteraction", () => {
    // Mock client and common test variables
    const mockClient = { request: vi.fn() } as unknown as FrakClient;
    const mockWallet = "0x1234567890123456789012345678901234567890" as Address;
    const mockReferrer =
        "0xabcdef1234567890123456789012345678901234" as Address;
    const mockProductId = "0x123" as Hex;

    // Mock console.warn for all tests
    const originalConsoleWarn = console.warn;

    beforeEach(async () => {
        // Reset mocks
        vi.resetAllMocks();
        console.warn = vi.fn();

        // Import mocked modules
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../watchWalletStatus");
        const { processReferral } = await import("./processReferral");

        // Setup default mock returns
        vi.mocked(FrakContextManager.parse).mockReturnValue({
            r: mockReferrer,
        } as FrakContext);

        vi.mocked(watchWalletStatus).mockResolvedValue({
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        } as WalletStatusReturnType);

        vi.mocked(processReferral).mockResolvedValue("success");

        // Mock window.location.href
        Object.defineProperty(window, "location", {
            value: {
                href: `https://example.com/?r=${mockReferrer}`,
            },
            writable: true,
        });
    });

    afterEach(() => {
        console.warn = originalConsoleWarn;
    });

    it("should call FrakContextManager.parse with the current URL", async () => {
        // Import mocked modules
        const { FrakContextManager } = await import("../../utils");

        // Execute
        await referralInteraction(mockClient);

        // Verify
        expect(FrakContextManager.parse).toHaveBeenCalledWith({
            url: `https://example.com/?r=${mockReferrer}`,
        });
    });

    it("should call watchWalletStatus with the client", async () => {
        // Import mocked modules
        const { watchWalletStatus } = await import("../watchWalletStatus");

        // Execute
        await referralInteraction(mockClient);

        // Verify
        expect(watchWalletStatus).toHaveBeenCalledWith(mockClient);
    });

    it("should call processReferral with the correct parameters", async () => {
        // Import mocked modules
        const { FrakContextManager } = await import("../../utils");
        const { watchWalletStatus } = await import("../watchWalletStatus");
        const { processReferral } = await import("./processReferral");

        // Setup
        const modalConfig: DisplayModalParamsType<ModalStepTypes[]> = {
            steps: {
                login: {},
            },
        };
        const options = { alwaysAppendUrl: true };
        const mockWalletStatus = {
            key: "connected",
            wallet: mockWallet,
        } as WalletStatusReturnType;

        vi.mocked(watchWalletStatus).mockResolvedValue(mockWalletStatus);

        const mockContext = { r: mockReferrer };
        vi.mocked(FrakContextManager.parse).mockReturnValue(mockContext);

        // Execute
        await referralInteraction(mockClient, {
            productId: mockProductId,
            modalConfig,
            options,
        });

        // Verify
        expect(processReferral).toHaveBeenCalledWith(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockContext,
            modalConfig,
            productId: mockProductId,
            options,
        });
    });

    it("should return the result from processReferral", async () => {
        // Import mocked modules
        const { processReferral } = await import("./processReferral");

        // Setup
        vi.mocked(processReferral).mockResolvedValue("no-referrer");

        // Execute
        const result = await referralInteraction(mockClient);

        // Verify
        expect(result).toBe("no-referrer");
    });

    it("should handle errors from processReferral and return undefined", async () => {
        // Import mocked modules
        const { processReferral } = await import("./processReferral");

        // Setup
        vi.mocked(processReferral).mockRejectedValue(new Error("Test error"));

        // Execute
        const result = await referralInteraction(mockClient);

        // Verify
        expect(result).toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith("Error processing referral", {
            error: expect.any(Error),
        });
    });

    it("should work with default parameters", async () => {
        // Import mocked modules
        const { processReferral } = await import("./processReferral");

        // Execute
        await referralInteraction(mockClient);

        // Verify
        expect(processReferral).toHaveBeenCalledWith(mockClient, {
            walletStatus: expect.anything(),
            frakContext: expect.anything(),
            modalConfig: undefined,
            productId: undefined,
            options: undefined,
        });
    });
});
