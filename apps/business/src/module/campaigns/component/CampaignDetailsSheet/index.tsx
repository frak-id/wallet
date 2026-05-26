import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { Button } from "@/module/common/component/Button";
import { formatDate } from "@/module/common/utils/formatDate";
import { formatPrice } from "@/module/common/utils/formatPrice";
import type { CampaignWithActions } from "@/types/Campaign";
import * as styles from "./campaign-details-sheet.css";

type Props = {
    campaign: CampaignWithActions | undefined;
    onOpenChange: (open: boolean) => void;
};

export function CampaignDetailsSheet({ campaign, onOpenChange }: Props) {
    return (
        <Sheet open={!!campaign} onOpenChange={onOpenChange}>
            <SheetContent side="right">
                {campaign && <CampaignDetailsContent campaign={campaign} />}
            </SheetContent>
        </Sheet>
    );
}

function CampaignDetailsContent({
    campaign,
}: {
    campaign: CampaignWithActions;
}) {
    const startDate = campaign.publishedAt ?? campaign.createdAt;
    const firstBudget = campaign.budgetConfig?.[0];
    const usedAmount =
        (firstBudget && campaign.budgetUsed?.[firstBudget.label]?.used) ?? 0;
    const remaining = firstBudget ? firstBudget.amount - usedAmount : 0;

    return (
        <>
            <SheetHeader>
                <SheetTitle>{campaign.name}</SheetTitle>
                <SheetDescription asChild>
                    <span>
                        <CampaignStateTag
                            status={campaign.status}
                            expiresAt={campaign.expiresAt}
                            bankDistributionStatus={
                                campaign.bankDistributionStatus
                            }
                        />
                    </span>
                </SheetDescription>
            </SheetHeader>

            <Stack space="l">
                <Section title="Schedule">
                    <Row
                        label="Published"
                        value={
                            startDate ? formatDate(new Date(startDate)) : "—"
                        }
                    />
                    <Row
                        label="End date"
                        value={
                            campaign.expiresAt
                                ? formatDate(new Date(campaign.expiresAt))
                                : "No end date"
                        }
                    />
                </Section>

                {firstBudget && (
                    <Section title="Budget">
                        <Row
                            label="Remaining"
                            value={`${formatPrice(
                                remaining,
                                undefined,
                                "EUR"
                            )} / ${formatPrice(
                                firstBudget.amount,
                                undefined,
                                "EUR"
                            )}`}
                        />
                        <div className={styles.budgetType}>
                            {firstBudget.label || "Global"}
                        </div>
                    </Section>
                )}
            </Stack>

            <SheetFooter>
                <SheetClose asChild>
                    <Button variant="ghost">Close</Button>
                </SheetClose>
            </SheetFooter>
        </>
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
