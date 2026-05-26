import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    ArchiveIcon,
    BinIcon,
    CloseIcon,
    PauseIcon,
} from "@frak-labs/design-system/icons";
import { useState } from "react";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";
import { campaignSelectionStore } from "@/stores/campaignSelectionStore";
import type { CampaignWithActions } from "@/types/Campaign";
import * as styles from "./campaigns-edit-bar.css";
import {
    type BulkAction,
    eligible,
    useBulkCampaignActions,
} from "./useBulkCampaignActions";

const COPY: Record<
    BulkAction,
    { title: string; verb: string; confirmLabel: string }
> = {
    pause: { title: "Pause campaigns", verb: "pause", confirmLabel: "Pause" },
    archive: {
        title: "Archive campaigns",
        verb: "archive",
        confirmLabel: "Archive",
    },
    delete: {
        title: "Delete campaigns",
        verb: "delete",
        confirmLabel: "Delete",
    },
};

type Props = {
    merchantId: string;
    selected: CampaignWithActions[];
};

export function CampaignsEditBar({ merchantId, selected }: Props) {
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

    const confirmCopy = confirm ? COPY[confirm] : null;
    const eligibleCount = confirm
        ? selected.filter((c) => eligible(confirm, c)).length
        : 0;

    return (
        <>
            <div className={styles.bar}>
                <Inline space="m" alignY="center">
                    <span className={styles.count}>
                        {selected.length} selected
                    </span>
                    <Button
                        variant="secondary"
                        size="small"
                        icon={<PauseIcon width={16} height={16} />}
                        disabled={!canPauseAny || pending !== null}
                        onClick={() => setConfirm("pause")}
                    >
                        Pause
                    </Button>
                    <Button
                        variant="secondary"
                        size="small"
                        icon={<ArchiveIcon width={16} height={16} />}
                        disabled={!canArchiveAny || pending !== null}
                        onClick={() => setConfirm("archive")}
                    >
                        Archive
                    </Button>
                    <Button
                        variant="destructive"
                        size="small"
                        icon={<BinIcon width={16} height={16} />}
                        disabled={!canDeleteAny || pending !== null}
                        onClick={() => setConfirm("delete")}
                    >
                        Delete
                    </Button>
                </Inline>
                <Button
                    variant="primary"
                    size="small"
                    rightIcon={<CloseIcon width={16} height={16} />}
                    onClick={() => clear()}
                    disabled={pending !== null}
                >
                    Clear
                </Button>
            </div>

            {confirm && confirmCopy && (
                <AlertDialog
                    open={confirm !== null}
                    onOpenChange={(open) => {
                        if (!open) setConfirm(null);
                    }}
                    title={confirmCopy.title}
                    description={
                        <>
                            Are you sure you want to {confirmCopy.verb}{" "}
                            <strong>{eligibleCount}</strong> campaign
                            {eligibleCount > 1 ? "s" : ""}?
                        </>
                    }
                    cancel={<Button variant="secondary">Cancel</Button>}
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
                            {confirmCopy.confirmLabel}
                        </Button>
                    }
                />
            )}
        </>
    );
}
