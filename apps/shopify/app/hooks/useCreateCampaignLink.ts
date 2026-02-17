import type { loader as rootLoader } from "app/routes/app";
import { useMemo } from "react";
import { useRouteLoaderData } from "react-router";
import type { Address } from "viem";
import { buildCampaignLink } from "../utils/url";

export function useCreateCampaignLink({
    globalBudget,
    bankId,
    rawCAC,
    ratio,
    name,
    merchantId,
}: {
    bankId: Address;
    globalBudget: number;
    rawCAC: number;
    ratio: number;
    name: string;
    merchantId: string;
}) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");

    return useMemo(
        () =>
            buildCampaignLink({
                businessUrl:
                    process.env.BUSINESS_URL ?? "https://business.frak.id",
                name,
                bankId,
                domain: rootData?.shop?.domain ?? "",
                globalBudget,
                rawCAC,
                ratio,
                merchantId,
                preferredCurrency: rootData?.shop?.preferredCurrency,
            }),
        [
            rawCAC,
            ratio,
            globalBudget,
            name,
            rootData?.shop?.domain,
            rootData?.shop?.preferredCurrency,
            bankId,
            merchantId,
        ]
    );
}
