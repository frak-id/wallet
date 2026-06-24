import {
    ArchiveIcon,
    BarChartIcon,
    BinIcon,
    EyeIcon,
    PauseIcon,
    PencilIcon,
    PlayIcon,
} from "@frak-labs/design-system/icons";
import { Link } from "@tanstack/react-router";
import type { Row } from "@tanstack/react-table";
import clsx from "clsx";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
    ModalArchive,
    ModalDelete,
    ModalPause,
    ModalResume,
} from "@/module/campaigns/component/CampaignActionModals";
import {
    RowMenu,
    RowMenuDivider,
    RowMenuSection,
} from "@/module/common/component/RowMenu";
import * as rowMenu from "@/module/common/component/RowMenu/row-menu.css";
import { campaignStore } from "@/stores/campaignStore";
import type { CampaignListItemWithActions } from "@/types/Campaign";

type Props = {
    row: Row<CampaignListItemWithActions>;
    merchantId: string;
};

type SectionId = "nav" | "lifecycle" | "destructive";

export function CellRowMenu({ row, merchantId }: Props) {
    const { t } = useTranslation();
    const reset = campaignStore((state) => state.reset);
    const { actions, status, id, name } = row.original;
    const isDraft = status === "draft";

    const navSection = (
        <RowMenuSection>
            {isDraft ? (
                <Link
                    to="/m/$merchantId/campaigns/draft/$campaignId"
                    params={{ merchantId, campaignId: id }}
                    onClick={() => reset()}
                    className={rowMenu.item}
                >
                    <EyeIcon width={16} height={16} />
                    <span>{t("campaigns.rowMenu.viewParameters")}</span>
                </Link>
            ) : (
                <Link
                    to="/m/$merchantId/campaigns/list"
                    params={{ merchantId }}
                    search={{ campaign: id, tab: "config" }}
                    className={rowMenu.item}
                >
                    <EyeIcon width={16} height={16} />
                    <span>{t("campaigns.rowMenu.viewParameters")}</span>
                </Link>
            )}
            {!isDraft && (
                <Link
                    to="/m/$merchantId/campaigns/list"
                    params={{ merchantId }}
                    search={{ campaign: id, tab: "funnel" }}
                    className={rowMenu.item}
                >
                    <BarChartIcon width={16} height={16} />
                    <span>{t("campaigns.rowMenu.openPerformance")}</span>
                </Link>
            )}
            {actions.canEdit && (
                <Link
                    to="/m/$merchantId/campaigns/draft/$campaignId"
                    params={{ merchantId, campaignId: id }}
                    onClick={() => reset()}
                    className={rowMenu.item}
                >
                    <PencilIcon width={16} height={16} />
                    <span>{t("campaigns.rowMenu.edit")}</span>
                </Link>
            )}
        </RowMenuSection>
    );

    const lifecycleItems: React.ReactNode[] = [];
    if (actions.canPause) {
        lifecycleItems.push(
            <ModalPause
                key="pause"
                campaignId={id}
                merchantId={merchantId}
                campaignName={name}
                trigger={
                    <button type="button" className={rowMenu.item}>
                        <PauseIcon width={16} height={16} />
                        <span>{t("campaigns.rowMenu.pause")}</span>
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
                merchantId={merchantId}
                campaignName={name}
                trigger={
                    <button type="button" className={rowMenu.item}>
                        <PlayIcon width={16} height={16} />
                        <span>{t("campaigns.rowMenu.resume")}</span>
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
                merchantId={merchantId}
                campaignName={name}
                trigger={
                    <button type="button" className={rowMenu.item}>
                        <ArchiveIcon width={16} height={16} />
                        <span>{t("campaigns.rowMenu.archive")}</span>
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
                merchantId={merchantId}
                campaignName={name}
                trigger={
                    <button
                        type="button"
                        className={clsx(rowMenu.item, rowMenu.itemDestructive)}
                    >
                        <BinIcon width={16} height={16} />
                        <span>{t("campaigns.rowMenu.delete")}</span>
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
            node: <RowMenuSection>{lifecycleItems}</RowMenuSection>,
        });
    }
    if (destructiveItems.length > 0) {
        sections.push({
            id: "destructive",
            node: <RowMenuSection>{destructiveItems}</RowMenuSection>,
        });
    }

    return (
        <RowMenu ariaLabel={t("campaigns.rowMenu.ariaActions", { name })}>
            {sections.map((section, idx) => (
                <Fragment key={section.id}>
                    {idx > 0 && <RowMenuDivider />}
                    {section.node}
                </Fragment>
            ))}
        </RowMenu>
    );
}
