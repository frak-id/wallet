import { Stack } from "@frak-labs/design-system/components/Stack";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import { BigNumber, MetricCard, Section, useDetailFormatters } from "./parts";
import { TopAmbassadorsTable } from "./TopAmbassadorsTable";
import { truncateWallet } from "./truncateWallet";

export function AmbassadorsTab({ data }: { data: CampaignDetailsStats }) {
    const { t } = useTranslation();
    const { ambassadorStats, efficiency } = data;
    const fmt = useDetailFormatters(efficiency.currency);

    return (
        <Stack space="l">
            <Tiles columns={3} space="m">
                <MetricCard
                    label={t("campaigns.details.stats.ambassadors")}
                    descriptor={t("campaigns.details.stats.total")}
                    sub={t("campaigns.details.stats.registered")}
                >
                    <BigNumber
                        format={fmt.integer}
                        value={ambassadorStats.total}
                    />
                </MetricCard>
                <MetricCard
                    label={t("campaigns.details.stats.activeUsers")}
                    sub={t("campaigns.details.stats.sharedAtLeastOnce")}
                >
                    <BigNumber
                        format={fmt.percent0}
                        value={ambassadorStats.activePct}
                    />
                </MetricCard>
                <MetricCard
                    label={t("campaigns.details.stats.refereesConverted")}
                    sub={t("campaigns.details.stats.clicksToPurchase")}
                >
                    <BigNumber
                        format={fmt.percent0}
                        value={ambassadorStats.refereesConvertedPct}
                    />
                </MetricCard>
            </Tiles>

            <Section title={t("campaigns.details.top.title")}>
                <TopAmbassadorsTable
                    topAmbassadors={data.topAmbassadors}
                    currency={efficiency.currency}
                />
            </Section>

            <Section title={t("campaigns.details.efficiency.title")}>
                <Tiles columns={3} space="m">
                    <MetricCard
                        label={t("campaigns.details.efficiency.ambassadors")}
                        descriptor={t("campaigns.details.efficiency.roi")}
                        sub={t(
                            "campaigns.details.efficiency.revenueBudgetSpent"
                        )}
                    >
                        <BigNumber
                            format={fmt.decimal1}
                            value={efficiency.roi}
                            prefix="x"
                        />
                    </MetricCard>
                    <MetricCard
                        label={t(
                            "campaigns.details.efficiency.avgRewardEarned"
                        )}
                        sub={t(
                            "campaigns.details.efficiency.perActiveAmbassador"
                        )}
                    >
                        <BigNumber
                            format={fmt.currency}
                            value={efficiency.avgReward}
                        />
                    </MetricCard>
                    <MetricCard
                        label={t("campaigns.details.efficiency.topPerformer")}
                        sub={t("campaigns.details.efficiency.ofCampaignRev", {
                            wallet: truncateWallet(
                                efficiency.topPerformerWallet
                            ),
                        })}
                    >
                        <BigNumber
                            format={fmt.percent0}
                            value={efficiency.topPerformerPct}
                        />
                    </MetricCard>
                </Tiles>
            </Section>
        </Stack>
    );
}
