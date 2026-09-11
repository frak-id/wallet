import { useParams } from "@tanstack/react-router";

/** The `_restricted/m/$merchantId` layout redirects away when the id isn't
 * accessible, so components underneath can assume it is present. */
export function useActiveMerchantId(): string {
    const { merchantId } = useParams({ from: "/_restricted/m/$merchantId" });
    return merchantId;
}

/** `undefined` outside a `/m/$merchantId/` route. The cast is needed because
 * `strict: false` params collapse to `unknown`. */
export function useOptionalActiveMerchantId(): string | undefined {
    const params = useParams({ strict: false }) as {
        merchantId?: string;
    };
    return params.merchantId;
}
