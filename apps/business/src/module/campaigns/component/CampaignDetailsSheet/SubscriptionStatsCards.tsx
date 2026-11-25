import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import { BigNumber, MetricCard, useDetailFormatters } from "./parts";

/** Plans in flight and what the plan reserved against what it already paid. */
export function SubscriptionStatsCards({
    subscription,
}: {
    subscription: NonNullable<CampaignDetailsStats["subscription"]>;
}) {
    const { t } = useTranslation();
    const fmt = useDetailFormatters(subscription.currency);

    return (
        <Tiles columns={2} space="m">
            <MetricCard
                label={t("campaigns.details.subscription.livePlans")}
                sub={t("campaigns.details.subscription.livePlansSub")}
            >
                <BigNumber
                    format={fmt.integer}
                    value={subscription.livePlans}
                />
            </MetricCard>

            <MetricCard
                label={t("campaigns.details.subscription.stepsPaid")}
                sub={t("campaigns.details.subscription.stepsPaidSub")}
            >
                <BigNumber
                    format={fmt.integer}
                    value={subscription.stepsPaid}
                />
            </MetricCard>

            <MetricCard
                label={t("campaigns.details.subscription.reserved")}
                sub={t("campaigns.details.subscription.reservedSub")}
            >
                <BigNumber
                    format={fmt.currency}
                    value={subscription.reserved}
                />
            </MetricCard>

            <MetricCard
                label={t("campaigns.details.subscription.paid")}
                sub={t("campaigns.details.subscription.paidSub")}
            >
                <BigNumber format={fmt.currency} value={subscription.paid} />
            </MetricCard>
        </Tiles>
    );
}
