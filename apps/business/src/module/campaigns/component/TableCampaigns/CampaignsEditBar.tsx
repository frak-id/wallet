import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    ArchiveIcon,
    BinIcon,
    CloseIcon,
    PauseIcon,
} from "@frak-labs/design-system/icons";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { campaignSelectionStore } from "@/stores/campaignSelectionStore";
import type { CampaignListItemWithActions } from "@/types/Campaign";
import * as styles from "./campaigns-edit-bar.css";
import {
    type BulkAction,
    eligible,
    useBulkCampaignActions,
} from "./useBulkCampaignActions";

const ACTION_KEYS = {
    pause: {
        titleKey: "campaigns.bulk.pauseTitle",
        labelKey: "campaigns.bulk.pause",
        confirmKey: "campaigns.bulk.confirmPause",
    },
    archive: {
        titleKey: "campaigns.bulk.archiveTitle",
        labelKey: "campaigns.bulk.archive",
        confirmKey: "campaigns.bulk.confirmArchive",
    },
    delete: {
        titleKey: "campaigns.bulk.deleteTitle",
        labelKey: "campaigns.bulk.delete",
        confirmKey: "campaigns.bulk.confirmDelete",
    },
} as const satisfies Record<
    BulkAction,
    { titleKey: string; labelKey: string; confirmKey: string }
>;

type Props = {
    merchantId: string;
    selected: CampaignListItemWithActions[];
};

export function CampaignsEditBar({ merchantId, selected }: Props) {
    const { t } = useTranslation();
    const clear = campaignSelectionStore((state) => state.clear);
    const { run, pending } = useBulkCampaignActions();
    const [confirm, setConfirm] = useState<BulkAction | null>(null);

    const canPauseAny = selected.some((c) => c.actions.canPause);
    const canArchiveAny = selected.some((c) => c.actions.canArchive);
    const canDeleteAny = selected.some((c) => c.actions.canDelete);

    const confirmBulkAction = async () => {
        if (!confirm) return;
        await run(confirm, { merchantId, campaigns: selected });
        setConfirm(null);
        clear();
    };

    const confirmKeys = confirm ? ACTION_KEYS[confirm] : null;
    const eligibleCount = confirm
        ? selected.filter((c) => eligible(confirm, c)).length
        : 0;

    return (
        <>
            <div className={styles.bar}>
                <Inline space="m" alignY="center">
                    <span className={styles.count}>
                        {t("campaigns.bulk.selected", {
                            count: selected.length,
                        })}
                    </span>
                    <Button
                        variant="secondary"
                        size="small"
                        icon={<PauseIcon width={16} height={16} />}
                        disabled={!canPauseAny || pending !== null}
                        onClick={() => setConfirm("pause")}
                    >
                        {t("campaigns.bulk.pause")}
                    </Button>
                    <Button
                        variant="secondary"
                        size="small"
                        icon={<ArchiveIcon width={16} height={16} />}
                        disabled={!canArchiveAny || pending !== null}
                        onClick={() => setConfirm("archive")}
                    >
                        {t("campaigns.bulk.archive")}
                    </Button>
                    <Button
                        variant="destructive"
                        size="small"
                        icon={<BinIcon width={16} height={16} />}
                        disabled={!canDeleteAny || pending !== null}
                        onClick={() => setConfirm("delete")}
                    >
                        {t("campaigns.bulk.delete")}
                    </Button>
                </Inline>
                <Button
                    variant="primary"
                    size="small"
                    rightIcon={<CloseIcon width={16} height={16} />}
                    onClick={() => clear()}
                    disabled={pending !== null}
                >
                    {t("campaigns.bulk.clear")}
                </Button>
            </div>

            {confirm && confirmKeys && (
                <AlertDialog
                    open={confirm !== null}
                    onOpenChange={(open) => {
                        if (!open) setConfirm(null);
                    }}
                    title={t(confirmKeys.titleKey)}
                    description={
                        <Trans
                            i18nKey={confirmKeys.confirmKey}
                            count={eligibleCount}
                            components={{ strong: <strong /> }}
                        />
                    }
                    cancel={
                        <Button variant="secondary">
                            {t("campaigns.actions.cancel")}
                        </Button>
                    }
                    action={
                        <Button
                            variant={
                                confirm === "delete"
                                    ? "destructive"
                                    : "secondary"
                            }
                            loading={pending !== null}
                            disabled={pending !== null}
                            onClick={confirmBulkAction}
                        >
                            {t(confirmKeys.labelKey)}
                        </Button>
                    }
                />
            )}
        </>
    );
}
