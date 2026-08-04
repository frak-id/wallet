import { describe, expect, it } from "vitest";
import type { CreateReferralLinkPayload } from "../../../domain/rewards/types";
import type { HandlerContext } from "../types";
import { SharingHandler } from "./SharingHandler";

const ctx: HandlerContext = {
    identity: { identityGroupId: "group-1" },
    merchantId: "merchant-1",
};
const payload = {} as CreateReferralLinkPayload;

describe("SharingHandler", () => {
    describe("buildExternalEventId", () => {
        it("uses idempotencyKey when present, even alongside purchaseId", () => {
            const handler = new SharingHandler();

            const id = handler.buildExternalEventId(
                {
                    merchantId: "merchant-1",
                    purchaseId: "purchase-1",
                    idempotencyKey: "idem-1",
                },
                payload,
                ctx
            );

            expect(id).toBe("create_referral_link:group-1:merchant-1:idem-1");
        });

        it("falls back to purchaseId when idempotencyKey is absent", () => {
            const handler = new SharingHandler();

            const id = handler.buildExternalEventId(
                { merchantId: "merchant-1", purchaseId: "purchase-1" },
                payload,
                ctx
            );

            expect(id).toBe(
                "create_referral_link:group-1:merchant-1:purchase-1"
            );
        });

        it("falls back to a numeric Date.now() key when neither is present", () => {
            const handler = new SharingHandler();

            const id = handler.buildExternalEventId(
                { merchantId: "merchant-1" },
                payload,
                ctx
            );

            const prefix = "create_referral_link:group-1:merchant-1:";
            expect(id.startsWith(prefix)).toBe(true);
            expect(Number.isNaN(Number(id.slice(prefix.length)))).toBe(false);
        });
    });
});
