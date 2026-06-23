import { Sheet, SheetContent } from "@frak-labs/design-system/components/Sheet";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { campaignDetailsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type { CampaignListItemWithActions } from "@/types/Campaign";
import { AmbassadorsTab } from "./AmbassadorsTab";
import { ConfigTab } from "./ConfigTab";
import * as styles from "./campaign-details-sheet.css";
import { ExportButton } from "./ExportButton";
import { FunnelRoiTab } from "./FunnelRoiTab";

export const CAMPAIGN_DETAILS_TABS = [
    "funnel",
    "ambassadors",
    "config",
] as const;
export type CampaignDetailsTab = (typeof CAMPAIGN_DETAILS_TABS)[number];

type Props = {
    campaign: CampaignListItemWithActions | undefined;
    onOpenChange: (open: boolean) => void;
    tab?: CampaignDetailsTab;
    onTabChange?: (tab: CampaignDetailsTab) => void;
};

export function CampaignDetailsSheet({
    campaign,
    onOpenChange,
    tab,
    onTabChange,
}: Props) {
    return (
        <Sheet open={!!campaign} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                size="wide"
                padded={false}
                hideCloseButton
            >
                {campaign && (
                    <CampaignDetailsContent
                        campaign={campaign}
                        onClose={() => onOpenChange(false)}
                        tab={tab}
                        onTabChange={onTabChange}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function CampaignDetailsContent({
    campaign,
    onClose,
    tab,
    onTabChange,
}: {
    campaign: CampaignListItemWithActions;
    onClose: () => void;
    tab?: CampaignDetailsTab;
    onTabChange?: (tab: CampaignDetailsTab) => void;
}) {
    const { t } = useTranslation();
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data } = useQuery(
        campaignDetailsQueryOptions({
            merchantId,
            campaignId: campaign.id,
            isDemoMode,
        })
    );

    return (
        <>
            <SheetCloseToolbar
                onClose={onClose}
                closeLabel={t("campaigns.details.close")}
                title={campaign.name}
                subtitle={
                    <>
                        {data && (
                            <>
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    color="secondary"
                                >
                                    {t(
                                        "campaigns.details.subtitle.ambassadors",
                                        {
                                            count: data.ambassadorStats.total,
                                        }
                                    )}
                                </Text>
                                <span className={styles.subtitleDot}>·</span>
                            </>
                        )}
                        <CampaignStateTag
                            status={campaign.status}
                            expiresAt={campaign.expiresAt}
                        />
                    </>
                }
                action={<ExportButton />}
            />

            {!data ? null : (
                <div className={styles.body}>
                    <Tabs
                        value={tab ?? "funnel"}
                        onValueChange={(value) =>
                            onTabChange?.(value as CampaignDetailsTab)
                        }
                    >
                        <TabsList variant="navigation">
                            <TabsTrigger variant="navigation" value="funnel">
                                {t("campaigns.details.tabs.funnelRoi")}
                            </TabsTrigger>
                            <TabsTrigger
                                variant="navigation"
                                value="ambassadors"
                            >
                                {t("campaigns.details.tabs.ambassadors")}
                            </TabsTrigger>
                            <TabsTrigger variant="navigation" value="config">
                                {t("campaigns.details.tabs.configuration")}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent
                            value="funnel"
                            className={styles.tabsContent}
                        >
                            <FunnelRoiTab data={data} />
                        </TabsContent>
                        <TabsContent
                            value="ambassadors"
                            className={styles.tabsContent}
                        >
                            <AmbassadorsTab data={data} />
                        </TabsContent>
                        <TabsContent
                            value="config"
                            className={styles.tabsContent}
                        >
                            <ConfigTab campaignId={campaign.id} />
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </>
    );
}
