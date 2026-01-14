import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import type { Address } from "viem";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from "../../../tests/vitest-fixtures";
import type {
    FrakClient,
    FrakContext,
    WalletStatusReturnType,
} from "../../types";
import { processReferral } from "./processReferral";

// Mock dependencies
vi.mock("../index", () => ({
    displayEmbeddedWallet: vi.fn(),
}));

vi.mock("../../utils", () => ({
    FrakContextManager: {
        replaceUrl: vi.fn(),
    },
    trackEvent: vi.fn(),
}));

describe("processReferral", () => {
    let mockClient: FrakClient;
    let mockAddress: Address;
    let mockReferrerAddress: Address;
    let mockWalletStatus: WalletStatusReturnType;
    let mockFrakContext: Partial<FrakContext>;

    beforeEach(async () => {
        vi.clearAllMocks();

        mockAddress = "0x1234567890123456789012345678901234567890" as Address;
        mockReferrerAddress =
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address;

        mockClient = {
            openPanel: {
                track: vi.fn(),
            },
            config: {
                metadata: {
                    name: "Test App",
                },
                domain: "example.com",
            },
            request: vi.fn(),
        } as unknown as FrakClient;

        mockWalletStatus = {
            key: "connected" as const,
            wallet: mockAddress,
        };

        mockFrakContext = {
            r: mockReferrerAddress,
        };

        // Mock window.location
        Object.defineProperty(window, "location", {
            value: {
                href: "https://example.com/test",
            },
            writable: true,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should return 'no-referrer' when frakContext has no referrer", async () => {
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: {},
        });

        expect(result).toBe("no-referrer");
    });

    it("should return 'no-referrer' when frakContext is null", async () => {
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: null,
        });

        expect(result).toBe("no-referrer");
    });

    it("should return 'self-referral' when referrer equals current wallet", async () => {
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: {
                r: mockAddress, // Same as wallet
            },
        });

        expect(result).toBe("self-referral");
    });

    it("should successfully process referral when all conditions are met", async () => {
        const utils = await import("../../utils");

        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
        });

        expect(result).toBe("success");

        expect(utils.trackEvent).toHaveBeenCalledWith(
            mockClient,
            "user_referred_started",
            {
                properties: {
                    referrer: mockReferrerAddress,
                    walletStatus: "connected",
                },
            }
        );

        expect(utils.trackEvent).toHaveBeenCalledWith(
            mockClient,
            "user_referred_completed",
            {
                properties: {
                    status: "success",
                    referrer: mockReferrerAddress,
                    wallet: mockAddress,
                },
            }
        );
    });

    it("should handle wallet not connected scenario", async () => {
        const { displayEmbeddedWallet } = await import("../index");

        // Mock displayEmbeddedWallet to return a wallet
        vi.mocked(displayEmbeddedWallet).mockResolvedValue({
            wallet: mockAddress,
        } as any);

        const result = await processReferral(mockClient, {
            walletStatus: undefined,
            frakContext: mockFrakContext,
        });

        expect(result).toBe("success");
        expect(displayEmbeddedWallet).toHaveBeenCalled();
    });

    it("should return 'no-wallet' when wallet connection fails", async () => {
        const { displayEmbeddedWallet } = await import("../index");

        const error = new FrakRpcError(
            RpcErrorCodes.walletNotConnected,
            "Wallet not connected"
        );
        vi.mocked(displayEmbeddedWallet).mockRejectedValue(error);

        const result = await processReferral(mockClient, {
            walletStatus: undefined,
            frakContext: mockFrakContext,
        });

        expect(result).toBe("no-wallet");
    });

    it("should return 'error' for unknown errors", async () => {
        const { displayEmbeddedWallet } = await import("../index");

        const error = new Error("Unknown error");
        vi.mocked(displayEmbeddedWallet).mockRejectedValue(error);

        const result = await processReferral(mockClient, {
            walletStatus: undefined,
            frakContext: mockFrakContext,
        });

        expect(result).toBe("error");
    });

    it("should update URL context when alwaysAppendUrl is true", async () => {
        const utils = await import("../../utils");

        await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            options: {
                alwaysAppendUrl: true,
            },
        });

        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: { r: mockAddress },
        });
    });

    it("should remove URL context when alwaysAppendUrl is false", async () => {
        const utils = await import("../../utils");

        await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            options: {
                alwaysAppendUrl: false,
            },
        });

        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: null,
        });
    });

    it("should remove URL context by default", async () => {
        const utils = await import("../../utils");

        await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
        });

        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: null,
        });
    });
});
