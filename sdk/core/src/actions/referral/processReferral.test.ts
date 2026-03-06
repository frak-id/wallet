import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import type { Address } from "viem";
import { vi } from "vitest";
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
    FrakContextV2,
    WalletStatusReturnType,
} from "../../types";
import { processReferral } from "./processReferral";

vi.mock("../displayEmbeddedWallet", () => ({
    displayEmbeddedWallet: vi.fn(),
}));

vi.mock("../sendInteraction", () => ({
    sendInteraction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils", () => ({
    FrakContextManager: {
        replaceUrl: vi.fn(),
    },
    trackEvent: vi.fn(),
    resolveMerchantId: vi.fn().mockResolvedValue(undefined),
    getClientId: vi.fn().mockReturnValue("test-client-id"),
}));

describe("processReferral", () => {
    let mockClient: FrakClient;
    let mockAddress: Address;
    let mockWalletStatus: WalletStatusReturnType;

    beforeEach(async () => {
        vi.clearAllMocks();

        mockAddress = "0x1234567890123456789012345678901234567890" as Address;

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

    it("should return 'no-referrer' when frakContext is null", async () => {
        const result = await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: null,
        });

        expect(result).toBe("no-referrer");
    });

    describe("V2 context", () => {
        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        it("should successfully process v2 referral", async () => {
            const utils = await import("../../utils");
            const { sendInteraction } = await import("../sendInteraction");

            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: v2Context,
            });

            expect(result).toBe("success");

            expect(utils.trackEvent).toHaveBeenCalledWith(
                mockClient,
                "user_referred_started",
                {
                    properties: {
                        referrerClientId: "referrer-client-id",
                        walletStatus: "connected",
                    },
                }
            );

            expect(sendInteraction).toHaveBeenCalledWith(mockClient, {
                type: "arrival",
                referrerClientId: "referrer-client-id",
                referrerMerchantId: "merchant-uuid",
                referralTimestamp: 1709654400,
                landingUrl: "https://example.com/test",
            });
        });

        it("should return 'self-referral' when v2 context has same clientId as current user", async () => {
            const utils = await import("../../utils");
            vi.mocked(utils.getClientId).mockReturnValue("referrer-client-id");

            const v2SelfReferralContext: FrakContextV2 = {
                v: 2,
                c: "referrer-client-id",
                m: "merchant-uuid",
                t: 1709654400,
            };

            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: v2SelfReferralContext,
            });

            expect(result).toBe("self-referral");
            vi.mocked(utils.getClientId).mockReturnValue("test-client-id");
        });
    });

    describe("V1 context (backward compat)", () => {
        const v1Context: FrakContext = {
            r: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
        };

        it("should successfully process v1 referral", async () => {
            const utils = await import("../../utils");

            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: v1Context,
            });

            expect(result).toBe("success");

            expect(utils.trackEvent).toHaveBeenCalledWith(
                mockClient,
                "user_referred_started",
                {
                    properties: {
                        referrer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                        walletStatus: "connected",
                    },
                }
            );
        });

        it("should return 'self-referral' when v1 referrer matches current wallet", async () => {
            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: {
                    r: mockAddress,
                },
            });

            expect(result).toBe("self-referral");
        });
    });

    it("should handle wallet not connected scenario", async () => {
        const { displayEmbeddedWallet } = await import(
            "../displayEmbeddedWallet"
        );

        vi.mocked(displayEmbeddedWallet).mockResolvedValue({
            wallet: mockAddress,
        } as any);

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        const result = await processReferral(mockClient, {
            walletStatus: undefined,
            frakContext: v2Context,
            modalConfig: {} as any,
        });

        expect(result).toBe("success");
        expect(displayEmbeddedWallet).toHaveBeenCalled();
    });

    it("should return 'no-wallet' when wallet connection fails", async () => {
        const { displayEmbeddedWallet } = await import(
            "../displayEmbeddedWallet"
        );

        const error = new FrakRpcError(
            RpcErrorCodes.walletNotConnected,
            "Wallet not connected"
        );
        vi.mocked(displayEmbeddedWallet).mockRejectedValue(error);

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        const result = await processReferral(mockClient, {
            walletStatus: undefined,
            frakContext: v2Context,
            modalConfig: {} as any,
        });

        expect(result).toBe("no-wallet");
    });

    it("should return 'error' for unknown errors", async () => {
        const { displayEmbeddedWallet } = await import(
            "../displayEmbeddedWallet"
        );

        const error = new Error("Unknown error");
        vi.mocked(displayEmbeddedWallet).mockRejectedValue(error);

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        const result = await processReferral(mockClient, {
            walletStatus: undefined,
            frakContext: v2Context,
            modalConfig: {} as any,
        });

        expect(result).toBe("error");
    });

    it("should update URL context when alwaysAppendUrl is true", async () => {
        const utils = await import("../../utils");

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: v2Context,
            options: {
                alwaysAppendUrl: true,
            },
        });

        expect(utils.getClientId()).toBe("test-client-id");

        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: expect.objectContaining({
                v: 2,
                c: "test-client-id",
                m: "merchant-uuid",
            }),
        });
    });

    it("should remove URL context when alwaysAppendUrl is false", async () => {
        const utils = await import("../../utils");

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: v2Context,
            options: {
                alwaysAppendUrl: false,
            },
        });

        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: null,
        });
    });
});
