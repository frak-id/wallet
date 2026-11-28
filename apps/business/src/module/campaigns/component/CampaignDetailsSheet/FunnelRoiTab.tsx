import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import { CpaBreakdownBar } from "./CpaBreakdownBar";
import { EconomicValueCards } from "./EconomicValueCards";
import { Section } from "./parts";
import { SubscriptionStatsCards } from "./SubscriptionStatsCards";

export function FunnelRoiTab({ data }: { data: CampaignDetailsStats }) {
    const { t } = useTranslation();
    return (
        <Stack space="l">
            <Section title={t("campaigns.details.economic.title")}>
                <EconomicValueCards economicValue={data.economicValue} />
            </Section>
            {data.subscription && (
                <Section title={t("campaigns.details.subscription.title")}>
                    <SubscriptionStatsCards subscription={data.subscription} />
                </Section>
            )}
            <Section title={t("campaigns.details.cpa.title")}>
                <CpaBreakdownBar cpaBreakdown={data.cpaBreakdown} />
            </Section>
        </Stack>
    );
}
