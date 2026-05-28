import { Stack } from "@frak-labs/design-system/components/Stack";
import { useSuspenseQuery } from "@tanstack/react-query";
import { campaignsOverviewQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { FunnelCard } from "./FunnelCard";
import { KpiCardsRow } from "./KpiCardsRow";
import { OverviewFloatingFooter } from "./OverviewFloatingFooter";
import * as styles from "./overview.css";
import { ProjectedRevenueCard } from "./ProjectedRevenueCard";
import { PurchasesCard } from "./PurchasesCard";
import { SharingBySourceCard } from "./SharingBySourceCard";
import { TopCampaignsCard } from "./TopCampaignsCard";

export function CampaignsOverview({
    from,
    to,
}: {
    from?: string;
    to?: string;
}) {
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(
        campaignsOverviewQueryOptions({ merchantId, isDemoMode, from, to })
    );

    return (
        <div className={styles.page}>
            <Stack space="l">
                <KpiCardsRow kpis={data.kpis} />
                <div className={styles.twoColumns}>
                    <FunnelCard funnels={data.funnels} />
                    <TopCampaignsCard
                        topCampaigns={data.topCampaigns}
                        statusBreakdown={data.statusBreakdown}
                    />
                </div>
                <div className={styles.threeColumns}>
                    <PurchasesCard purchases={data.purchases} />
                    <ProjectedRevenueCard
                        projectedRevenue={data.projectedRevenue}
                    />
                    <SharingBySourceCard sharing={data.sharing} />
                </div>
            </Stack>
            <OverviewFloatingFooter />
        </div>
    );
}
