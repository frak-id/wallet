import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferralService } from "../../../domain/attribution";
import type { HandlerContext } from "../types";
import { ArrivalHandler } from "./ArrivalHandler";

const findGroupByIdentity = vi.fn();

vi.mock("../../../domain/identity", () => ({
    IdentityContext: {
        repositories: {
            identity: {
                findGroupByIdentity: (...args: unknown[]) =>
                    findGroupByIdentity(...args),
            },
        },
    },
}));

const validWallet = "0x1234567890123456789012345678901234567890" as Address;
const otherWallet = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;

function makeHandler() {
    const registerReferral = vi.fn().mockResolvedValue({
        registered: true,
        link: { id: "link-123" },
    });
    const referralService = {
        registerReferral,
    } as unknown as ReferralService;
    return {
        handler: new ArrivalHandler(referralService),
        registerReferral,
    };
}

const ctx: HandlerContext = {
    identity: { identityGroupId: "group-receiver" },
    merchantId: "merchant-1",
};

describe("ArrivalHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findGroupByIdentity.mockReset();
    });

    describe("registerReferral wiring", () => {
        it("forwards sharedAt sourceData when referralTimestamp is present", async () => {
            const { handler, registerReferral } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-referrer" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: validWallet,
                    referralTimestamp: 1709654400,
                },
                ctx
            );

            expect(registerReferral).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                referrerIdentityGroupId: "group-referrer",
                refereeIdentityGroupId: "group-receiver",
                sourceData: { type: "link", sharedAt: 1709654400 },
            });
        });

        it("omits sharedAt when referralTimestamp is missing", async () => {
            const { handler, registerReferral } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-referrer" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerWallet: validWallet,
                },
                ctx
            );

            expect(registerReferral).toHaveBeenCalledWith({
                merchantId: "merchant-1",
                referrerIdentityGroupId: "group-referrer",
                refereeIdentityGroupId: "group-receiver",
                sourceData: { type: "link" },
            });
        });

        it("does not call registerReferral when no referrer is provided", async () => {
            const { handler, registerReferral } = makeHandler();

            await handler.buildPayload({ merchantId: "merchant-1" }, ctx);

            expect(registerReferral).not.toHaveBeenCalled();
        });

        it("does not call registerReferral when referrer cannot be resolved", async () => {
            const { handler, registerReferral } = makeHandler();
            findGroupByIdentity.mockResolvedValue(null);

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                },
                ctx
            );

            expect(registerReferral).not.toHaveBeenCalled();
        });

        it("ignores malformed wallet (invalid hex) and falls back to clientId path", async () => {
            const { handler, registerReferral } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-referrer" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: "0xnot-a-real-wallet",
                },
                ctx
            );

            expect(findGroupByIdentity).toHaveBeenCalledWith({
                type: "anonymous_fingerprint",
                value: "client-xyz",
                merchantId: "merchant-referrer",
            });
            expect(registerReferral).toHaveBeenCalled();
        });
    });

    describe("resolveReferrerGroupId", () => {
        it("uses wallet lookup first when a valid wallet is present", async () => {
            const { handler } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-wallet" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: validWallet,
                },
                ctx
            );

            expect(findGroupByIdentity).toHaveBeenCalledWith({
                type: "wallet",
                value: validWallet,
            });
        });

        it("falls back to anonymous_fingerprint when wallet lookup returns null", async () => {
            const { handler, registerReferral } = makeHandler();
            findGroupByIdentity
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: "group-anon" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: validWallet,
                },
                ctx
            );

            expect(findGroupByIdentity).toHaveBeenNthCalledWith(1, {
                type: "wallet",
                value: validWallet,
            });
            expect(findGroupByIdentity).toHaveBeenNthCalledWith(2, {
                type: "anonymous_fingerprint",
                value: "client-xyz",
                merchantId: "merchant-referrer",
            });
            expect(registerReferral).toHaveBeenCalledWith(
                expect.objectContaining({
                    referrerIdentityGroupId: "group-anon",
                })
            );
        });
    });

    describe("buildPayload output shape", () => {
        it("returns the link id and registered flag from registerReferral", async () => {
            const { handler } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-x" });

            const payload = await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: validWallet,
                    referralTimestamp: 1709654400,
                },
                ctx
            );

            expect(payload).toEqual({
                referrerWallet: validWallet,
                referrerClientId: "client-xyz",
                referrerMerchantId: "merchant-referrer",
                referralTimestamp: 1709654400,
                referralLinkId: "link-123",
                referralRegistered: true,
            });
        });

        it("drops a malformed wallet from the payload", async () => {
            const { handler } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-x" });

            const payload = await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: "0xnot-a-wallet",
                },
                ctx
            );

            expect(payload.referrerWallet).toBeUndefined();
            expect(payload.referrerClientId).toBe("client-xyz");
        });

        it("returns null link id and registered=false when registration fails (duplicate)", async () => {
            findGroupByIdentity.mockResolvedValue({ id: "group-referrer" });
            const reg = vi.fn().mockResolvedValue({ registered: false });
            const handler = new ArrivalHandler({
                registerReferral: reg,
            } as unknown as ReferralService);

            const payload = await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerWallet: validWallet,
                },
                ctx
            );

            expect(payload.referralLinkId).toBeNull();
            expect(payload.referralRegistered).toBe(false);
            expect(reg).toHaveBeenCalled();
        });
    });

    describe("shouldCreateInteractionLog", () => {
        it("is true only when referralRegistered is true", () => {
            const { handler } = makeHandler();
            expect(
                handler.shouldCreateInteractionLog?.(
                    { merchantId: "m" },
                    {
                        referrerWallet: otherWallet,
                        referralLinkId: "link-1",
                        referralRegistered: true,
                    }
                )
            ).toBe(true);

            expect(
                handler.shouldCreateInteractionLog?.(
                    { merchantId: "m" },
                    {
                        referrerWallet: otherWallet,
                        referralLinkId: null,
                        referralRegistered: false,
                    }
                )
            ).toBe(false);
        });
    });
});
