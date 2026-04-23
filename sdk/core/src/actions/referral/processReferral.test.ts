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
                    referrerClientId: "referrer-client-id",
                    referrerWallet: undefined,
                    walletStatus: "connected",
                }
            );

            expect(sendInteraction).toHaveBeenCalledWith(mockClient, {
                type: "arrival",
                referrerClientId: "referrer-client-id",
                referrerMerchantId: "merchant-uuid",
                referrerWallet: undefined,
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

        it("should successfully process v2 referral with wallet only (no clientId)", async () => {
            await import("../../utils");
            const { sendInteraction } = await import("../sendInteraction");

            const referrerWallet =
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
            const v2WithWalletOnly: FrakContextV2 = {
                v: 2,
                m: "merchant-uuid",
                t: 1709654400,
                w: referrerWallet,
            };

            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: v2WithWalletOnly,
            });

            expect(result).toBe("success");
            expect(sendInteraction).toHaveBeenCalledWith(mockClient, {
                type: "arrival",
                referrerClientId: undefined,
                referrerMerchantId: "merchant-uuid",
                referrerWallet,
                referralTimestamp: 1709654400,
                landingUrl: "https://example.com/test",
            });
        });

        it("should return 'self-referral' when v2 wallet matches current wallet", async () => {
            const v2SelfReferralByWallet: FrakContextV2 = {
                v: 2,
                m: "merchant-uuid",
                t: 1709654400,
                w: mockAddress,
            };

            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: v2SelfReferralByWallet,
            });

            expect(result).toBe("self-referral");
        });

        it("should prefer wallet over clientId for self-referral when both are present", async () => {
            const utils = await import("../../utils");
            // clientId does NOT match current user, but wallet does → still self-referral
            vi.mocked(utils.getClientId).mockReturnValue("some-other-client");

            const v2Hybrid: FrakContextV2 = {
                v: 2,
                c: "referrer-client-id",
                m: "merchant-uuid",
                t: 1709654400,
                w: mockAddress,
            };

            const result = await processReferral(mockClient, {
                walletStatus: mockWalletStatus,
                frakContext: v2Hybrid,
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
                    referrer: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                    walletStatus: "connected",
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
                w: mockAddress,
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

    it("should emit wallet in replacement context when alwaysAppendUrl is true and user is connected", async () => {
        const utils = await import("../../utils");
        vi.mocked(utils.getClientId).mockReturnValue(null as never);

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        await processReferral(mockClient, {
            walletStatus: mockWalletStatus,
            frakContext: v2Context,
            options: { alwaysAppendUrl: true },
        });

        // clientId is null, but wallet is available — should still emit {w, m}
        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: expect.objectContaining({
                v: 2,
                m: "merchant-uuid",
                w: mockAddress,
            }),
        });

        vi.mocked(utils.getClientId).mockReturnValue("test-client-id");
    });

    it("should return null replacement context when both clientId and wallet are missing", async () => {
        const utils = await import("../../utils");
        vi.mocked(utils.getClientId).mockReturnValue(null as never);

        const v2Context: FrakContextV2 = {
            v: 2,
            c: "referrer-client-id",
            m: "merchant-uuid",
            t: 1709654400,
        };

        await processReferral(mockClient, {
            walletStatus: { key: "not-connected" as const },
            frakContext: v2Context,
            options: { alwaysAppendUrl: true },
        });

        expect(utils.FrakContextManager.replaceUrl).toHaveBeenCalledWith({
            url: window.location.href,
            context: null,
        });

        vi.mocked(utils.getClientId).mockReturnValue("test-client-id");
    });
});
