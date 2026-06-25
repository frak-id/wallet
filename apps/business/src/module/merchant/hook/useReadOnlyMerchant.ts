import { useMerchant } from "@/module/merchant/hook/useMerchant";

/**
 * Returns true when the current user is viewing a merchant as a platform admin
 * in read-only mode. The backend enforces read-only; this is defense-in-depth
 * for the UI (disabling mutation affordances and showing the banner).
 */
export function useReadOnlyMerchant({
    merchantId,
}: {
    merchantId: string | undefined;
}): boolean {
    // useMerchant's queryOptions already has enabled:!!merchantId, so passing
    // an empty string is safe and avoids a conditional hook call.
    const { data } = useMerchant({ merchantId: merchantId ?? "" });
    return data?.role === "platform_admin";
}
