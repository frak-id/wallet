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
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useState } from "react";
import {
    ModalArchive,
    ModalDelete,
    ModalPause,
    ModalResume,
} from "@/module/campaigns/component/CampaignActionModals";
import { BudgetUsage } from "@/module/campaigns/component/CampaignDetails/BudgetUsage";
import { CampaignStateTag } from "@/module/campaigns/component/TableCampaigns/CampaignStateTag";
import { Button } from "@/module/common/component/Button";
import { LinkButton } from "@/module/common/component/LinkButton";
import { formatDate } from "@/module/common/utils/formatDate";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";
import * as styles from "./campaign-parameters-sheet.css";

type Props = {
    campaign: Campaign;
    campaignId: string;
};

export function CampaignParametersSheet({ campaign, campaignId }: Props) {
    const [open, setOpen] = useState(false);
    const reset = campaignStore((state) => state.reset);

    const canEdit = campaign.status !== "archived";
    const canPause = campaign.status === "active";
    const canResume = campaign.status === "paused";
    const canArchive =
        campaign.status === "active" || campaign.status === "paused";
    const canDelete = campaign.status === "draft";

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="secondary">View parameters</Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>{campaign.name}</SheetTitle>
                    <SheetDescription asChild>
                        <span>
                            <CampaignStateTag
                                status={campaign.status}
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
                            label="Created"
                            value={formatDate(new Date(campaign.createdAt))}
                        />
                        {campaign.publishedAt && (
                            <Row
                                label="Published"
                                value={formatDate(
                                    new Date(campaign.publishedAt)
                                )}
                            />
                        )}
                        {campaign.expiresAt && (
                            <Row
                                label="Expires"
                                value={formatDate(new Date(campaign.expiresAt))}
                            />
                        )}
                    </Section>

                    <Section title="Budget">
                        <BudgetUsage campaign={campaign} />
                    </Section>
                </Stack>

                <SheetFooter>
                    {canEdit && (
                        <LinkButton
                            to="/campaigns/edit/$campaignId"
                            params={{ campaignId }}
                            variant="secondary"
                            onClick={() => reset()}
                        >
                            Edit
                        </LinkButton>
                    )}
                    {canPause && (
                        <ModalPause
                            campaignId={campaignId}
                            merchantId={campaign.merchantId}
                            campaignName={campaign.name}
                            trigger={<Button variant="secondary">Pause</Button>}
                            onDone={() => setOpen(false)}
                        />
                    )}
                    {canResume && (
                        <ModalResume
                            campaignId={campaignId}
                            merchantId={campaign.merchantId}
                            campaignName={campaign.name}
                            trigger={<Button variant="primary">Resume</Button>}
                            onDone={() => setOpen(false)}
                        />
                    )}
                    {canArchive && (
                        <ModalArchive
                            campaignId={campaignId}
                            merchantId={campaign.merchantId}
                            campaignName={campaign.name}
                            trigger={
                                <Button variant="secondary">Archive</Button>
                            }
                            onDone={() => setOpen(false)}
                        />
                    )}
                    {canDelete && (
                        <ModalDelete
                            campaignId={campaignId}
                            merchantId={campaign.merchantId}
                            campaignName={campaign.name}
                            trigger={
                                <Button variant="destructive">Delete</Button>
                            }
                            onDone={() => setOpen(false)}
                        />
                    )}
                    <SheetClose asChild>
                        <Button variant="ghost">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
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

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className={styles.labelRow}>
            <span className={styles.labelText}>{label}</span>
            <span className={styles.valueText}>{value}</span>
        </div>
    );
}
