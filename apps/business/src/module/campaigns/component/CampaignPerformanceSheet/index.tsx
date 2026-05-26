import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { CampaignStats } from "@/module/campaigns/api/campaignStatsApi";
import { campaignsStatsQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { useConvertToPreferredCurrency } from "@/module/common/hook/useConversionRate";
import type { Campaign } from "@/types/Campaign";
import * as styles from "./campaign-performance-sheet.css";

type Props = {
    campaignId: string;
    campaign: Campaign;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export function CampaignPerformanceSheet({
    campaignId,
    campaign,
    trigger,
    open: openProp,
    onOpenChange: onOpenChangeProp,
}: Props) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isControlled = openProp !== undefined;
    const open = isControlled ? openProp : internalOpen;
    const handleOpenChange = onOpenChangeProp ?? setInternalOpen;
    const isDemoMode = useIsDemoMode();
    const merchantId = useActiveMerchantId();
    const { data: stats } = useSuspenseQuery(
        campaignsStatsQueryOptions({ merchantId, isDemoMode })
    );
    const campaignStats = stats?.find((s) => s.campaignId === campaignId);

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            {!isControlled && (
                <SheetTrigger asChild>
                    {trigger ?? (
                        <Button variant="secondary">View performance</Button>
                    )}
                </SheetTrigger>
            )}
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>{campaign.name}</SheetTitle>
                    <SheetDescription>Performance details</SheetDescription>
                </SheetHeader>

                {campaignStats ? (
                    <PerformanceBody stats={campaignStats} />
                ) : (
                    <p className={styles.emptyState}>
                        Performance data isn't available yet for this campaign.
                    </p>
                )}

                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="ghost">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

function PerformanceBody({ stats }: { stats: CampaignStats }) {
    return (
        <div className={styles.body}>
            <Section title="Activity">
                <Row label="Ambassadors" value={stats.ambassador} />
                <Row
                    label="Shares"
                    value={stats.createReferredLinkInteractions}
                />
                <Row
                    label="Referred users"
                    value={stats.referredInteractions}
                />
                <Row label="Purchases" value={stats.purchaseInteractions} />
            </Section>

            <Section title="Conversion">
                <Row
                    label="Sharing rate"
                    value={formatPercent(stats.sharingRate)}
                />
                <Row label="CTR" value={formatPercent(stats.ctr)} />
            </Section>

            <Section title="Spending">
                <CurrencyRow
                    label="Cost per share"
                    token={stats.tokenAddress}
                    amount={stats.costPerShare}
                />
                <CurrencyRow
                    label="Cost per action"
                    token={stats.tokenAddress}
                    amount={stats.costPerPurchase}
                />
                <CurrencyRow
                    label="Amount spent"
                    token={stats.tokenAddress}
                    amount={stats.totalRewards}
                />
            </Section>
        </div>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3 className={styles.sectionTitle}>{title}</h3>
            <div className={styles.sectionBody}>{children}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <div className={styles.labelRow}>
            <span className={styles.labelText}>{label}</span>
            <span className={styles.valueText}>{value}</span>
        </div>
    );
}

function CurrencyRow({
    label,
    token,
    amount,
}: {
    label: string;
    token: CampaignStats["tokenAddress"];
    amount: number;
}) {
    const converted = useConvertToPreferredCurrency({
        token: token ?? undefined,
        amount,
    });
    return <Row label={label} value={converted ?? "—"} />;
}

function formatPercent(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
}
