import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import {
    Sheet,
    SheetContent,
    SheetToolbar,
} from "@frak-labs/design-system/components/Sheet";
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
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type { CampaignWithActions } from "@/types/Campaign";
import { AmbassadorsTab } from "./AmbassadorsTab";
import * as styles from "./campaign-details-sheet.css";
import { ExportButton } from "./ExportButton";
import { FunnelRoiTab } from "./FunnelRoiTab";

type Props = {
    campaign: CampaignWithActions | undefined;
    onOpenChange: (open: boolean) => void;
};

export function CampaignDetailsSheet({ campaign, onOpenChange }: Props) {
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
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function CampaignDetailsContent({
    campaign,
    onClose,
}: {
    campaign: CampaignWithActions;
    onClose: () => void;
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

    if (!data) {
        return null;
    }

    return (
        <>
            <SheetToolbar
                leading={
                    <GlassCloseButton
                        onClick={onClose}
                        aria-label={t("campaigns.details.close")}
                    />
                }
                title={campaign.name}
                subtitle={
                    <>
                        <Text as="span" variant="bodySmall" color="secondary">
                            {t("campaigns.details.subtitle.ambassadors", {
                                count: data.ambassadorStats.total,
                            })}
                        </Text>
                        <span className={styles.subtitleDot}>·</span>
                        <CampaignStateTag
                            status={campaign.status}
                            expiresAt={campaign.expiresAt}
                        />
                    </>
                }
                action={<ExportButton />}
            />

            <div className={styles.body}>
                <Tabs defaultValue="funnel">
                    <TabsList variant="navigation">
                        <TabsTrigger variant="navigation" value="funnel">
                            {t("campaigns.details.tabs.funnelRoi")}
                        </TabsTrigger>
                        <TabsTrigger variant="navigation" value="ambassadors">
                            {t("campaigns.details.tabs.ambassadors")}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="funnel" className={styles.tabsContent}>
                        <FunnelRoiTab data={data} />
                    </TabsContent>
                    <TabsContent
                        value="ambassadors"
                        className={styles.tabsContent}
                    >
                        <AmbassadorsTab data={data} />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}
