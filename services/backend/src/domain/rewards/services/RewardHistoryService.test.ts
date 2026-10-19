import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { DetailedAssetLog } from "../types";
import { RewardHistoryService } from "./RewardHistoryService";

const TOKEN = "0x0000000000000000000000000000000000000001" as Address;

const welcomeBonusLog: DetailedAssetLog = {
    id: "asset-1",
    amount: "5",
    tokenAddress: TOKEN,
    status: "pending",
    recipientType: "welcome_bonus",
    createdAt: new Date("2026-09-25T10:00:00Z"),
    settledAt: null,
    availableAt: null,
    cancellationReason: null,
    onchainTxHash: null,
    interactionType: "purchase",
    interactionPayload: {
        orderId: "order-1",
        externalCustomerId: "customer-1",
        amount: 80,
        currency: "EUR",
        items: [],
        purchaseId: "purchase-1",
    },
    referralLinkId: "frak-link",
    identityGroupId: "user-group",
    merchantId: "merchant-1",
    merchantName: "Brand A",
    merchantDomain: "brand-a.com",
    merchantExplorerConfig: null,
};

const emptyEnrichment = {
    tokenMetadata: new Map(),
    tokenPrices: new Map(),
    purchaseAmounts: new Map(),
    referrerPurchases: new Map(),
};

describe("RewardHistoryService", () => {
    it.each([
        { status: "pending", merchantId: "frak", shown: "locked" },
        { status: "expired", merchantId: "frak", shown: "expired" },
        { status: "pending", merchantId: "merchant-1", shown: "pending" },
    ] as const)(
        "shows a $status reward at $merchantId as $shown while the merchant is locked",
        ({ status, merchantId, shown }) => {
            const [item] = new RewardHistoryService().buildRewardItems(
                [{ ...welcomeBonusLog, status, merchantId }],
                { ...emptyEnrichment, lockedMerchantId: "frak" }
            );

            expect(item?.status).toBe(shown);
        }
    );

    it("renders a welcome bonus with its role and the user's own purchase", () => {
        const [item] = new RewardHistoryService().buildRewardItems(
            [welcomeBonusLog],
            emptyEnrichment
        );

        expect(item).toMatchObject({
            role: "welcome_bonus",
            trigger: "purchase",
            purchase: { id: "purchase-1", amount: 80, currency: "EUR" },
        });
    });
});
