import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttributionService } from "../../../domain/attribution/services/AttributionService";
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

function makeHandler(
    recordTouchpointImpl?: Parameters<AttributionService["recordTouchpoint"]>[0]
) {
    const recordTouchpoint = vi.fn().mockResolvedValue({
        touchpoint: { id: "tp-123" },
        referralRegistered: true,
    });
    const attributionService = {
        recordTouchpoint,
    } as unknown as AttributionService;
    return {
        handler: new ArrivalHandler(attributionService),
        recordTouchpoint,
        params: recordTouchpointImpl,
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

    describe("buildSourceData", () => {
        it("emits V2 source_data with both clientId and wallet when both are valid", async () => {
            const { handler, recordTouchpoint } = makeHandler();
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

            const call = recordTouchpoint.mock.calls[0][0];
            expect(call.sourceData).toEqual({
                type: "referral_link",
                v: 2,
                referrerMerchantId: "merchant-referrer",
                referralTimestamp: 1709654400,
                referrerClientId: "client-xyz",
                referrerWallet: validWallet,
            });
        });

        it("emits V2 source_data with wallet only when clientId is missing", async () => {
            const { handler, recordTouchpoint } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-referrer" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerWallet: validWallet,
                },
                ctx
            );

            expect(recordTouchpoint.mock.calls[0][0].sourceData).toMatchObject({
                type: "referral_link",
                v: 2,
                referrerWallet: validWallet,
            });
            expect(
                recordTouchpoint.mock.calls[0][0].sourceData
            ).not.toHaveProperty("referrerClientId");
        });

        it("emits V1 source_data when only a valid wallet is provided (no merchantId)", async () => {
            const { handler, recordTouchpoint } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-referrer" });

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerWallet: validWallet,
                },
                ctx
            );

            expect(recordTouchpoint.mock.calls[0][0].sourceData).toEqual({
                type: "referral_link",
                v: 1,
                referrerWallet: validWallet,
            });
        });

        it("downgrades to paid_ad when only UTM fields are present", async () => {
            const { handler, recordTouchpoint } = makeHandler();

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    utmSource: "google",
                    utmCampaign: "spring",
                },
                ctx
            );

            expect(recordTouchpoint.mock.calls[0][0].sourceData).toEqual({
                type: "paid_ad",
                utmSource: "google",
                utmMedium: undefined,
                utmCampaign: "spring",
                utmTerm: undefined,
                utmContent: undefined,
            });
        });

        it("falls through to direct when nothing is present", async () => {
            const { handler, recordTouchpoint } = makeHandler();

            await handler.buildPayload({ merchantId: "merchant-1" }, ctx);

            expect(recordTouchpoint.mock.calls[0][0].sourceData).toEqual({
                type: "direct",
            });
        });

        it("ignores malformed wallet (invalid hex) and falls back cleanly", async () => {
            const { handler, recordTouchpoint } = makeHandler();
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

            const sourceData = recordTouchpoint.mock.calls[0][0].sourceData;
            expect(sourceData).toMatchObject({
                type: "referral_link",
                v: 2,
                referrerClientId: "client-xyz",
            });
            expect(sourceData).not.toHaveProperty("referrerWallet");
        });
    });

    describe("resolveReferrerGroupId", () => {
        it("uses wallet lookup first when a valid wallet is present", async () => {
            const { handler, recordTouchpoint } = makeHandler();
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

            // First call should have been wallet lookup
            expect(findGroupByIdentity).toHaveBeenCalledWith({
                type: "wallet",
                value: validWallet,
            });
            expect(
                recordTouchpoint.mock.calls[0][0].referrerIdentityGroupId
            ).toBe("group-wallet");
        });

        it("falls back to anonymous_fingerprint when wallet lookup returns null", async () => {
            const { handler, recordTouchpoint } = makeHandler();
            findGroupByIdentity
                .mockResolvedValueOnce(null) // wallet lookup misses
                .mockResolvedValueOnce({ id: "group-anon" }); // fingerprint hit

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
            expect(
                recordTouchpoint.mock.calls[0][0].referrerIdentityGroupId
            ).toBe("group-anon");
        });

        it("returns undefined when neither identifier resolves", async () => {
            const { handler, recordTouchpoint } = makeHandler();
            findGroupByIdentity.mockResolvedValue(null);

            await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                },
                ctx
            );

            expect(
                recordTouchpoint.mock.calls[0][0].referrerIdentityGroupId
            ).toBeUndefined();
        });
    });

    describe("buildPayload output shape", () => {
        it("forwards the validated wallet (not the raw input) into the payload", async () => {
            const { handler } = makeHandler();
            findGroupByIdentity.mockResolvedValue({ id: "group-x" });

            const payload = await handler.buildPayload(
                {
                    merchantId: "merchant-1",
                    referrerMerchantId: "merchant-referrer",
                    referrerClientId: "client-xyz",
                    referrerWallet: validWallet,
                    referralTimestamp: 1709654400,
                    landingUrl: "https://site.com/x",
                },
                ctx
            );

            expect(payload).toEqual({
                referrerWallet: validWallet,
                referrerClientId: "client-xyz",
                referrerMerchantId: "merchant-referrer",
                referralTimestamp: 1709654400,
                landingUrl: "https://site.com/x",
                touchpointId: "tp-123",
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
    });

    describe("shouldCreateInteractionLog", () => {
        it("is true only when referralRegistered is true", () => {
            const { handler } = makeHandler();
            expect(
                handler.shouldCreateInteractionLog?.(
                    { merchantId: "m" },
                    {
                        referrerWallet: otherWallet,
                        touchpointId: "t",
                        referralRegistered: true,
                    }
                )
            ).toBe(true);

            expect(
                handler.shouldCreateInteractionLog?.(
                    { merchantId: "m" },
                    {
                        referrerWallet: otherWallet,
                        touchpointId: "t",
                        referralRegistered: false,
                    }
                )
            ).toBe(false);
        });
    });
});
