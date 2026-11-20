import type { SlackMessage } from "./SlackClient";

export type PaymentProvider = "stripe" | "shopify";

export type PaymentNotification = {
    provider: PaymentProvider;
    /** Major units (e.g. `12.5` for €12.50). */
    amount: number;
    /** ISO 4217 code, any case. */
    currency: string;
    paidAt: Date;
    /** Provider-side id shown to ops: Stripe payment intent, Shopify app purchase. */
    reference: string;
    referenceUrl?: string;
    test: boolean;
    email?: string | null;
    payerName?: string | null;
    shop?: string | null;
    bankAddress?: string | null;
    merchant?: { id: string; name: string; domain: string } | null;
    /** Merchant reference the payment carried but that matched no merchant. */
    unmatchedReference?: string | null;
};

type BuildOptions = {
    channel: string;
    /** Prefixed to the header off-production, e.g. `staging`. */
    stage?: string;
    businessUrl?: string;
};

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
    stripe: "Stripe",
    shopify: "Shopify",
};

/** Slack mrkdwn control characters; everything payer-supplied goes through it. */
function escapeMrkdwn(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

export function formatPaymentAmount(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amount);
    } catch {
        return `${amount} ${currency.toUpperCase()}`;
    }
}

function field(label: string, value: string) {
    return { type: "mrkdwn", text: `*${label}*\n${value}` };
}

function merchantValue(
    notification: PaymentNotification,
    businessUrl?: string
): string {
    const { merchant, unmatchedReference } = notification;
    if (!merchant) {
        return unmatchedReference
            ? `_Not found_ (ref \`${escapeMrkdwn(unmatchedReference)}\`)`
            : "_Not found_";
    }
    const name = escapeMrkdwn(merchant.name);
    const label = businessUrl
        ? `<${businessUrl}/merchant/${merchant.id}|${name}>`
        : name;
    return `${label}\n${escapeMrkdwn(merchant.domain)}`;
}

/** The one Slack layout both payment providers post, so ops reads them the same way. */
export function buildPaymentMessage(
    notification: PaymentNotification,
    { channel, stage, businessUrl }: BuildOptions
): SlackMessage {
    const provider = PROVIDER_LABEL[notification.provider];
    const amount = formatPaymentAmount(
        notification.amount,
        notification.currency
    );
    const prefix = [
        stage ? `[${stage}]` : null,
        notification.test ? "[TEST]" : null,
    ]
        .filter(Boolean)
        .join(" ");
    const title = `${prefix ? `${prefix} ` : ""}${amount} paid via ${provider}`;

    const payer =
        notification.provider === "shopify"
            ? field("Shop", escapeMrkdwn(notification.shop ?? "—"))
            : field("Payer", escapeMrkdwn(notification.payerName ?? "—"));
    const reference = notification.referenceUrl
        ? `<${notification.referenceUrl}|${escapeMrkdwn(notification.reference)}>`
        : `\`${escapeMrkdwn(notification.reference)}\``;
    const paidAtUnix = Math.floor(notification.paidAt.getTime() / 1000);
    const merchantLabel = notification.merchant
        ? ` from ${escapeMrkdwn(notification.merchant.name)} (${escapeMrkdwn(notification.merchant.domain)})`
        : "";

    return {
        channel,
        text: `${title}${merchantLabel}`,
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: `💸 ${title}`, emoji: true },
            },
            {
                type: "section",
                fields: [
                    field("Merchant", merchantValue(notification, businessUrl)),
                    field("Email", escapeMrkdwn(notification.email ?? "—")),
                    payer,
                    field(
                        "Bank",
                        notification.bankAddress
                            ? `\`${notification.bankAddress}\``
                            : "—"
                    ),
                    field("Reference", reference),
                    field(
                        "Paid at",
                        `<!date^${paidAtUnix}^{date_short_pretty} at {time}|${notification.paidAt.toISOString()}>`
                    ),
                ],
            },
        ],
    };
}
