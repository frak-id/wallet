import { describe, expect, it } from "vitest";
import {
    buildPaymentMessage,
    formatPaymentAmount,
    type PaymentNotification,
} from "./buildPaymentMessage";

const PAID_AT = new Date("2026-11-20T10:00:00.000Z");

const base: PaymentNotification = {
    provider: "stripe",
    amount: 1200,
    currency: "eur",
    paidAt: PAID_AT,
    reference: "pi_123",
    referenceUrl: "https://dashboard.stripe.com/payments/pi_123",
    test: false,
    email: "jane@acme.com",
    payerName: "Jane <Doe>",
    bankAddress: "0x1111111111111111111111111111111111111111",
    merchant: { id: "m-1", name: "Acme & Co", domain: "acme.com" },
};

function fields(notification: PaymentNotification, stage?: string) {
    const message = buildPaymentMessage(notification, {
        channel: "payments",
        stage,
        businessUrl: "https://business.frak.id",
    });
    const blocks = message.blocks as [
        { text: { text: string } },
        { fields: { text: string }[] },
    ];
    return {
        message,
        header: blocks[0].text.text,
        fields: blocks[1].fields.map((field) => field.text),
    };
}

describe("buildPaymentMessage", () => {
    it("lays out a Stripe payment with merchant link and escaped payer input", () => {
        const { message, header, fields: texts } = fields(base);

        expect(message.channel).toBe("payments");
        expect(message.text).toBe(
            "€1,200.00 paid via Stripe from Acme &amp; Co (acme.com)"
        );
        expect(header).toBe("💸 €1,200.00 paid via Stripe");
        expect(texts).toEqual([
            "*Merchant*\n<https://business.frak.id/merchant/m-1|Acme &amp; Co>\nacme.com",
            "*Email*\njane@acme.com",
            "*Payer*\nJane &lt;Doe&gt;",
            "*Bank*\n`0x1111111111111111111111111111111111111111`",
            "*Reference*\n<https://dashboard.stripe.com/payments/pi_123|pi_123>",
            `*Paid at*\n<!date^${PAID_AT.getTime() / 1000}^{date_short_pretty} at {time}|2026-11-20T10:00:00.000Z>`,
        ]);
    });

    it("shows the shop for Shopify and flags staging test payments", () => {
        const { header, fields: texts } = fields(
            {
                ...base,
                provider: "shopify",
                test: true,
                shop: "acme.myshopify.com",
                referenceUrl: undefined,
                reference: "AppPurchaseOneTime 42",
            },
            "staging"
        );

        expect(header).toBe("💸 [staging] [TEST] €1,200.00 paid via Shopify");
        expect(texts[2]).toBe("*Shop*\nacme.myshopify.com");
        expect(texts[4]).toBe("*Reference*\n`AppPurchaseOneTime 42`");
    });

    it("keeps the unmatched merchant reference visible", () => {
        const { message, fields: texts } = fields({
            ...base,
            merchant: null,
            unmatchedReference: "not-a-merchant",
            email: null,
            bankAddress: null,
        });

        expect(message.text).toBe("€1,200.00 paid via Stripe");
        expect(texts[0]).toBe("*Merchant*\n_Not found_ (ref `not-a-merchant`)");
        expect(texts[1]).toBe("*Email*\n—");
        expect(texts[3]).toBe("*Bank*\n—");
    });
});

describe("formatPaymentAmount", () => {
    it("falls back to the raw code for a currency Intl rejects", () => {
        expect(formatPaymentAmount(10, "zzzz")).toBe("10 ZZZZ");
    });
});
