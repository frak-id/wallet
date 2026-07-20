import { beforeEach, describe, expect, it, type vi } from "vitest";

import { log } from "@backend-infrastructure";
import { merchantWebhooksRoutes } from "../../../src/api/business/merchant/webhooks";
// Shared infra mocks (db, log, business session middleware, …). The route
// consumes the session-resolved `hasGenuineMerchantAccess`, driven here via
// `setMockGenuineMerchantAccess`.
import {
    dbMock,
    resetMockBusinessSession,
    setMockBusinessSession,
    setMockGenuineMerchantAccess,
    setMockMerchantAccess,
} from "../../mock/common";

const MERCHANT_ID = "00000000-0000-0000-0000-0000000000w1";
const SIGNING_SECRET = "super-secret-hmac-key";

function stubWebhookRead() {
    let call = 0;
    dbMock.__setSelectResponse(() => {
        call += 1;
        if (call === 1) {
            return Promise.resolve([
                {
                    id: "00000000-0000-0000-0000-0000000000wh",
                    merchantId: MERCHANT_ID,
                    platform: "shopify",
                    hookSignatureKey: SIGNING_SECRET,
                },
            ]);
        }
        return Promise.resolve([
            {
                firstPurchase: undefined,
                lastPurchase: undefined,
                lastUpdate: undefined,
                totalPurchaseHandled: 0,
            },
        ]);
    });
}

async function getWebhookStatus() {
    const response = await merchantWebhooksRoutes.handle(
        new Request(`http://localhost/${MERCHANT_ID}/webhooks`, {
            headers: { "x-business-auth": "valid-token" },
        })
    );
    return { response, data: await response.json() };
}

describe("GET /:merchantId/webhooks — finding 2.8 (signing secret exposure)", () => {
    beforeEach(() => {
        resetMockBusinessSession();
        dbMock.__reset();
        setMockMerchantAccess(true);
        setMockGenuineMerchantAccess(false);
        (log.info as ReturnType<typeof vi.fn>).mockClear();
        stubWebhookRead();
        setMockBusinessSession({
            wallet: "0x1111111111111111111111111111111111111111",
        });
    });

    it("includes webhookSigninKey when the caller has genuine merchant access", async () => {
        setMockGenuineMerchantAccess(true);

        const { response, data } = await getWebhookStatus();

        expect(response.status).toBe(200);
        expect(data.webhookSigninKey).toBe(SIGNING_SECRET);
        expect(log.info).toHaveBeenCalledWith(
            expect.objectContaining({ merchantId: MERCHANT_ID }),
            "serving webhook signing secret"
        );
    });

    it("omits webhookSigninKey when access is not genuine (platform-admin read bypass)", async () => {
        // Route access granted (`hasMerchantAccess` true) but the genuine
        // grant is false — the shape produced when session.ts only granted
        // access via its platform-admin SAFE_METHODS bypass.
        const { response, data } = await getWebhookStatus();

        expect(response.status).toBe(200);
        expect(data.webhookSigninKey).toBeUndefined();
        expect(data.setup).toBe(true);
        expect(data.platform).toBe("shopify");
        expect(log.info).not.toHaveBeenCalled();
    });
});
