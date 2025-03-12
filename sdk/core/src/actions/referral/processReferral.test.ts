import type { Address, Hex } from "viem";
import {
    type Mock,
    type MockedFunction,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { ReferralInteractionEncoder } from "../../interactions";
import { type FrakClient, FrakRpcError, RpcErrorCodes } from "../../types";
import type {
    DisplayModalParamsType,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "../../types/rpc/displayModal";
import type { SendInteractionParamsType } from "../../types/rpc/interaction";
import type { WalletStatusReturnType } from "../../types/rpc/walletStatus";
import { processReferral } from "./processReferral";

// Mock dependencies
vi.mock("../../utils", () => ({
    FrakContextManager: {
        parse: vi.fn(),
        replaceUrl: vi.fn(),
    },
}));

// Mock modules for modal and interactions
vi.mock("../index", () => ({
    displayModal: vi.fn(),
    sendInteraction: vi.fn(),
}));

// Mock viem's isAddressEqual
vi.mock("viem", async () => {
    return {
        isAddressEqual: vi.fn().mockReturnValue(false), // Default to false (not self-referral)
        // We still need other exports from viem
        pad: (await vi.importActual("viem")).pad,
        toHex: (await vi.importActual("viem")).toHex,
        concatHex: (await vi.importActual("viem")).concatHex,
    };
});

describe("processReferral", () => {
    // Mock client and common test variables
    let mockClient: FrakClient;
    let mockDisplayModal: MockedFunction<
        (
            client: FrakClient,
            params: DisplayModalParamsType<ModalStepTypes[]>
        ) => Promise<ModalRpcStepsResultType<ModalStepTypes[]>>
    >;
    let mockSendInteraction: MockedFunction<
        (client: FrakClient, params: SendInteractionParamsType) => Promise<void>
    >;
    let mockFrakContextManager: {
        parse: Mock;
        replaceUrl: Mock;
    };
    const mockWallet = "0x1234567890123456789012345678901234567890" as Address;
    const mockReferrer =
        "0xabcdef1234567890123456789012345678901234" as Address;
    const mockProductId = "0x123" as Hex;

    // Reset mocks before each test
    beforeEach(async () => {
        vi.resetAllMocks();

        // Import mocked modules
        const indexModule = await import("../index");
        const utilsModule = await import("../../utils");

        // Setup mocks for easier access
        mockDisplayModal =
            indexModule.displayModal as unknown as typeof mockDisplayModal;
        mockSendInteraction =
            indexModule.sendInteraction as unknown as typeof mockSendInteraction;
        mockFrakContextManager = {
            parse: utilsModule.FrakContextManager.parse as Mock,
            replaceUrl: utilsModule.FrakContextManager.replaceUrl as Mock,
        };

        // Setup mock client
        mockClient = {
            request: vi.fn(),
        } as unknown as FrakClient;

        // Default mock implementations
        vi.mocked(mockDisplayModal).mockResolvedValue({
            login: { wallet: mockWallet },
        } as unknown as ModalRpcStepsResultType<ModalStepTypes[]>);

        vi.mocked(mockSendInteraction).mockResolvedValue(undefined);

        vi.mocked(mockFrakContextManager.replaceUrl).mockImplementation(
            () => {}
        );

        // Default for isAddressEqual is false (handled in the mock above)
    });

    it("should return 'no-referrer' when there is no referrer in the context", async () => {
        // Setup
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        };

        const mockFrakContext = {
            r: undefined,
        };

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
        });

        // Verify
        expect(result).toBe("no-referrer");
        expect(mockSendInteraction).not.toHaveBeenCalled();
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle errors properly", async () => {
        // Setup
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        };

        const mockFrakContext = {
            r: mockReferrer,
        };

        // Mock sendInteraction to throw FrakRpcError
        vi.mocked(mockSendInteraction).mockRejectedValue(
            new FrakRpcError(
                RpcErrorCodes.walletNotConnected,
                "Wallet not connected"
            )
        );

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
        });

        // Verify
        expect(result).toBe("no-wallet");
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle successful referral", async () => {
        // Setup for successful referral
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        };

        const mockFrakContext = {
            r: mockReferrer,
        };

        // Setup expected interaction
        const expectedInteraction = ReferralInteractionEncoder.referred({
            referrer: mockReferrer,
        });

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
        });

        // Verify
        expect(result).toBe("success");
        expect(mockSendInteraction).toHaveBeenCalledWith(mockClient, {
            productId: mockProductId,
            interaction: expectedInteraction,
        });
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle self-referrals properly", async () => {
        // Setup for self-referral
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        };

        const mockFrakContext = {
            r: mockWallet, // Same as wallet address
        };

        // Mock isAddressEqual to return true (self-referral)
        const viemModule = await import("viem");
        vi.mocked(viemModule.isAddressEqual).mockReturnValue(true);

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
        });

        // Verify
        expect(result).toBe("self-referral");
        expect(mockSendInteraction).not.toHaveBeenCalled();
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle wallet not connected and prompt login", async () => {
        // Setup for wallet not connected
        const mockWalletStatus: WalletStatusReturnType = {
            key: "not-connected", // Wallet not connected
        };

        const mockFrakContext = {
            r: mockReferrer,
        };

        // Setup modalConfig to ensure displayModal is called
        const mockModalConfig = {
            steps: ["login"],
        } as unknown as DisplayModalParamsType<ModalStepTypes[]>;

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
            modalConfig: mockModalConfig,
        });

        // Verify
        expect(mockDisplayModal).toHaveBeenCalled();
        expect(result).toBe("success");
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle case when user declines to login", async () => {
        // Setup for wallet not connected
        const mockWalletStatus: WalletStatusReturnType = {
            key: "not-connected",
        };

        const mockFrakContext = {
            r: mockReferrer,
        };

        // Setup modalConfig to ensure displayModal is called
        const mockModalConfig = {
            steps: ["login"],
        } as unknown as DisplayModalParamsType<ModalStepTypes[]>;

        // Mock displayModal to return no wallet (user declined)
        vi.mocked(mockDisplayModal).mockResolvedValue({
            login: { wallet: null },
        } as unknown as ModalRpcStepsResultType<ModalStepTypes[]>);

        // Here we're simulating that the user declined login process
        // Since no wallet is returned from displayModal, pushReferralInteraction will fail
        // with a walletNotConnected error when called
        vi.mocked(mockSendInteraction).mockRejectedValueOnce(
            new FrakRpcError(
                RpcErrorCodes.walletNotConnected,
                "Wallet not connected"
            )
        );

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
            modalConfig: mockModalConfig,
        });

        // Verify
        expect(mockDisplayModal).toHaveBeenCalled();
        expect(result).toBe("no-wallet");
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle different error types properly", async () => {
        // Setup
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        };

        const mockFrakContext = {
            r: mockReferrer,
        };

        // Mock sendInteraction to throw a generic error
        vi.mocked(mockSendInteraction).mockRejectedValue(
            new Error("Generic error")
        );

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
        });

        // Verify - should handle generic errors too
        expect(result).toBe("error");
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });

    it("should handle rate-limited errors specifically", async () => {
        // Setup
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: mockWallet,
            interactionSession: { startTimestamp: 123, endTimestamp: 456 },
        };

        const mockFrakContext = {
            r: mockReferrer,
        };

        // Mock sendInteraction to throw a rate-limited error
        vi.mocked(mockSendInteraction).mockRejectedValue(
            new FrakRpcError(
                RpcErrorCodes.serverErrorForInteractionDelegation,
                "Rate limited"
            )
        );

        // Execute
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            productId: mockProductId,
        });

        // Verify
        expect(result).toBe("no-session");
        expect(mockFrakContextManager.replaceUrl).toHaveBeenCalled();
    });
});
