/**
 * Tag the Stripe Payment Link so the payment webhook can name the merchant
 * (`client_reference_id`) and the payer starts from their account email.
 * Stripe drops either parameter silently when it is invalid.
 */
export function buildOnRampUrl(
    base: string | undefined,
    { merchantId, email }: { merchantId: string; email?: string | null }
): string {
    if (!base) return "#";
    let url: URL;
    try {
        url = new URL(base);
    } catch {
        return base;
    }
    url.searchParams.set("client_reference_id", merchantId);
    if (email) url.searchParams.set("prefilled_email", email);
    return url.toString();
}
