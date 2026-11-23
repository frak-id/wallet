// Leaf import: the `@backend-utils` barrel imports back into `infrastructure/`.
import { verifyTimestampedBody } from "../../../utils/timestampedHmac";

/** The Checkout Session fields a Payment Link payment notification reads. */
export type StripeCheckoutSession = {
    id: string;
    amount_total: number | null;
    currency: string | null;
    payment_status: "paid" | "unpaid" | "no_payment_required";
    payment_intent: string | null;
    client_reference_id: string | null;
    customer_details: { email: string | null; name: string | null } | null;
};

export type StripeEvent = {
    id: string;
    type: string;
    created: number;
    livemode: boolean;
    data: { object: unknown };
};

// https://docs.stripe.com/currencies#special-cases
const ZERO_DECIMAL_CURRENCIES = new Set([
    "bif",
    "clp",
    "djf",
    "gnf",
    "jpy",
    "kmf",
    "krw",
    "mga",
    "pyg",
    "rwf",
    "ugx",
    "vnd",
    "vuv",
    "xaf",
    "xof",
    "xpf",
]);
const THREE_DECIMAL_CURRENCIES = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

/** Stripe amounts are integers in the currency's smallest unit. */
export function stripeAmountToMajor(amount: number, currency: string): number {
    const code = currency.toLowerCase();
    if (ZERO_DECIMAL_CURRENCIES.has(code)) return amount;
    if (THREE_DECIMAL_CURRENCIES.has(code)) return amount / 1000;
    return amount / 100;
}

export function stripePaymentUrl(paymentIntentId: string, livemode: boolean) {
    return `https://dashboard.stripe.com/${livemode ? "" : "test/"}payments/${paymentIntentId}`;
}

/**
 * Verify a `Stripe-Signature` header (`t=…,v1=…[,v1=…]`) against the raw body.
 * `v0` and every other entry are ignored, as Stripe requires.
 */
export function isValidStripeSignature({
    body,
    header,
    secret,
    nowSeconds,
}: {
    body: string;
    header: string | undefined;
    secret: string;
    nowSeconds?: number;
}): boolean {
    if (!header) return false;
    let timestamp = "";
    const signatures: string[] = [];
    for (const entry of header.split(",")) {
        const [key, value] = entry.split("=", 2);
        if (key === "t" && value) timestamp = value;
        if (key === "v1" && value) signatures.push(value);
    }
    return verifyTimestampedBody({
        secret,
        timestamp,
        body,
        signatures,
        nowSeconds,
    });
}
