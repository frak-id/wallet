import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    isValidStripeSignature,
    stripeAmountToMajor,
    stripePaymentUrl,
} from "./index";

const SECRET = "whsec_test";
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';
const NOW = 1_800_000_000;
const sign = (timestamp: number, secret = SECRET) =>
    createHmac("sha256", secret).update(`${timestamp}.${BODY}`).digest("hex");

describe("isValidStripeSignature", () => {
    it("accepts a header carrying v0, debug entries and a valid v1", () => {
        const header = `t=${NOW},v1=${sign(NOW, "old")},v1=${sign(NOW)},v0=abc,destination=we_1`;

        expect(
            isValidStripeSignature({
                body: BODY,
                header,
                secret: SECRET,
                nowSeconds: NOW,
            })
        ).toBe(true);
    });

    it.each([
        ["no header", undefined],
        ["only a v0 signature", `t=${NOW},v0=${sign(NOW)}`],
        ["no timestamp", `v1=${sign(NOW)}`],
        ["a replayed timestamp", `t=${NOW - 600},v1=${sign(NOW - 600)}`],
    ])("rejects %s", (_name, header) => {
        expect(
            isValidStripeSignature({
                body: BODY,
                header,
                secret: SECRET,
                nowSeconds: NOW,
            })
        ).toBe(false);
    });
});

describe("stripeAmountToMajor", () => {
    it.each([
        [120_000, "eur", 1200],
        [120_000, "USD", 1200],
        [1200, "jpy", 1200],
        [1200, "kwd", 1.2],
    ])("converts %i %s to %d", (amount, currency, expected) => {
        expect(stripeAmountToMajor(amount, currency)).toBe(expected);
    });
});

describe("stripePaymentUrl", () => {
    it("points test-mode payments at the test dashboard", () => {
        expect(stripePaymentUrl("pi_1", true)).toBe(
            "https://dashboard.stripe.com/payments/pi_1"
        );
        expect(stripePaymentUrl("pi_1", false)).toBe(
            "https://dashboard.stripe.com/test/payments/pi_1"
        );
    });
});
