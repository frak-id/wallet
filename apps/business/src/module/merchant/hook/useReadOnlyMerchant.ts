import { useMerchant } from "@/module/merchant/hook/useMerchant";

/**
 * Returns true when the current user is viewing a merchant as a platform admin
 * in read-only mode. The backend enforces read-only; this is defense-in-depth
 * for the UI (disabling mutation affordances and showing the banner).
 */
export function useReadOnlyMerchant({
    merchantId,
}: { merchantId: string }): boolean {
    const { data } = useMerchant({ merchantId });
    return data?.role === "platform_admin";
}
