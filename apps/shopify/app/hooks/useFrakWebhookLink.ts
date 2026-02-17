import { useMemo } from "react";
import { buildWebhookLink } from "../utils/url";

export function useFrakWebhookLink({ merchantId }: { merchantId: string }) {
    return useMemo(
        () =>
            buildWebhookLink(
                process.env.BUSINESS_URL ?? "https://business.frak.id",
                merchantId
            ),
        [merchantId]
    );
}
