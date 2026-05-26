import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@frak-labs/design-system/components/Popover";
import {
    ArchiveIcon,
    BarChartIcon,
    BinIcon,
    EyeIcon,
    MoreVerticalIcon,
    PauseIcon,
    PencilIcon,
    PlayIcon,
} from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import type { Row } from "@tanstack/react-table";
import { Fragment, Suspense, useState } from "react";
import {
    ModalArchive,
    ModalDelete,
    ModalPause,
    ModalResume,
} from "@/module/campaigns/component/CampaignActionModals";
import { CampaignPerformanceSheet } from "@/module/campaigns/component/CampaignPerformanceSheet";
import { campaignStore } from "@/stores/campaignStore";
import type { CampaignWithActions } from "@/types/Campaign";
import * as styles from "./table-campaigns.css";

type Props = {
    row: Row<CampaignWithActions>;
    merchantId: string;
};

type SectionId = "nav" | "lifecycle" | "destructive";

export function CellRowMenu({ row, merchantId }: Props) {
    const [open, setOpen] = useState(false);
    const [performanceOpen, setPerformanceOpen] = useState(false);
    const reset = campaignStore((state) => state.reset);
    const { actions, status, id, name } = row.original;
    const isDraft = status === "draft";

    const navSection = (
        <div className={styles.rowMenuSection}>
            {isDraft ? (
                <Link
                    to="/m/$merchantId/campaigns/draft/$campaignId"
                    params={{ merchantId, campaignId: id }}
                    onClick={() => reset()}
                    className={styles.rowMenuItem}
                >
                    <EyeIcon width={16} height={16} />
                    <span>View parameters</span>
                </Link>
            ) : (
                <Link
                    to="/m/$merchantId/campaigns/$campaignId"
                    params={{ merchantId, campaignId: id }}
                    className={styles.rowMenuItem}
                >
                    <EyeIcon width={16} height={16} />
                    <span>View parameters</span>
                </Link>
            )}
            {!isDraft && (
                <button
                    type="button"
                    className={styles.rowMenuItem}
                    onClick={() => {
                        setOpen(false);
                        setPerformanceOpen(true);
                    }}
                >
                    <BarChartIcon width={16} height={16} />
                    <span>Open performance</span>
                </button>
            )}
            {actions.canEdit &&
                (isDraft ? (
                    <Link
                        to="/m/$merchantId/campaigns/draft/$campaignId"
                        params={{ merchantId, campaignId: id }}
                        onClick={() => reset()}
                        className={styles.rowMenuItem}
                    >
                        <PencilIcon width={16} height={16} />
                        <span>Edit campaign</span>
                    </Link>
                ) : (
                    <Link
                        to="/m/$merchantId/campaigns/edit/$campaignId"
                        params={{ merchantId, campaignId: id }}
                        onClick={() => reset()}
                        className={styles.rowMenuItem}
                    >
                        <PencilIcon width={16} height={16} />
                        <span>Edit campaign</span>
                    </Link>
                ))}
        </div>
    );

    const lifecycleItems: React.ReactNode[] = [];
    if (actions.canPause) {
        lifecycleItems.push(
            <ModalPause
                key="pause"
                campaignId={id}
                merchantId={row.original.merchantId}
                campaignName={name}
                trigger={
                    <button type="button" className={styles.rowMenuItem}>
                        <PauseIcon width={16} height={16} />
                        <span>Pause</span>
                    </button>
                }
            />
        );
    }
    if (actions.canResume) {
        lifecycleItems.push(
            <ModalResume
                key="resume"
                campaignId={id}
                merchantId={row.original.merchantId}
                campaignName={name}
                trigger={
                    <button type="button" className={styles.rowMenuItem}>
                        <PlayIcon width={16} height={16} />
                        <span>Resume</span>
                    </button>
                }
            />
        );
    }
    if (actions.canArchive) {
        lifecycleItems.push(
            <ModalArchive
                key="archive"
                campaignId={id}
                merchantId={row.original.merchantId}
                campaignName={name}
                trigger={
                    <button type="button" className={styles.rowMenuItem}>
                        <ArchiveIcon width={16} height={16} />
                        <span>Archive</span>
                    </button>
                }
            />
        );
    }

    const destructiveItems: React.ReactNode[] = [];
    if (actions.canDelete) {
        destructiveItems.push(
            <ModalDelete
                key="delete"
                campaignId={id}
                merchantId={row.original.merchantId}
                campaignName={name}
                trigger={
                    <button
                        type="button"
                        className={`${styles.rowMenuItem} ${styles.rowMenuItemDestructive}`}
                    >
                        <BinIcon width={16} height={16} />
                        <span>Delete</span>
                    </button>
                }
            />
        );
    }

    const sections: { id: SectionId; node: React.ReactNode }[] = [
        { id: "nav", node: navSection },
    ];
    if (lifecycleItems.length > 0) {
        sections.push({
            id: "lifecycle",
            node: <div className={styles.rowMenuSection}>{lifecycleItems}</div>,
        });
    }
    if (destructiveItems.length > 0) {
        sections.push({
            id: "destructive",
            node: (
                <div className={styles.rowMenuSection}>{destructiveItems}</div>
            ),
        });
    }

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={styles.rowMenuButton}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Actions for ${name}`}
                    >
                        <MoreVerticalIcon width={20} height={20} />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    sideOffset={6}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.rowMenuList}
                >
                    {sections.map((section, idx) => (
                        <Fragment key={section.id}>
                            {idx > 0 && (
                                <div className={styles.rowMenuDivider} />
                            )}
                            {section.node}
                        </Fragment>
                    ))}
                </PopoverContent>
            </Popover>
            {performanceOpen && (
                <Suspense fallback={null}>
                    <CampaignPerformanceSheet
                        campaignId={id}
                        campaign={row.original}
                        open={performanceOpen}
                        onOpenChange={setPerformanceOpen}
                    />
                </Suspense>
            )}
        </>
    );
}
