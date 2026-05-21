import { Archive, Pause, Play, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useDeleteCampaign } from "@/module/campaigns/hook/useDeleteCampaign";
import { useStatusTransition } from "@/module/campaigns/hook/useStatusTransition";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Button } from "@/module/common/component/Button";

type CampaignActionModalProps = {
    campaignId: string;
    merchantId: string;
    campaignName: string;
    trigger?: ReactNode;
    onDone?: () => void;
};

export function ModalPause({
    campaignId,
    merchantId,
    campaignName,
    trigger,
    onDone,
}: CampaignActionModalProps) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onPauseClick,
        isPending: isPausing,
        isError,
    } = useStatusTransition();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Pause campaign"}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Pause size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <>
                    Are you sure you want to pause the campaign{" "}
                    <strong>{campaignName}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"secondary"}
                    loading={isPausing}
                    disabled={isPausing}
                    onClick={async () => {
                        await onPauseClick({
                            campaignId,
                            merchantId,
                            action: "pause",
                        });
                        setOpen(false);
                        onDone?.();
                    }}
                >
                    Pause
                </Button>
            }
        />
    );
}

export function ModalResume({
    campaignId,
    merchantId,
    campaignName,
    trigger,
    onDone,
}: CampaignActionModalProps) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onResumeClick,
        isPending: isResuming,
        isError,
    } = useStatusTransition();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Resume campaign"}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Play size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <>
                    Are you sure you want to resume the campaign{" "}
                    <strong>{campaignName}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"primary"}
                    loading={isResuming}
                    disabled={isResuming}
                    onClick={async () => {
                        await onResumeClick({
                            campaignId,
                            merchantId,
                            action: "resume",
                        });
                        setOpen(false);
                        onDone?.();
                    }}
                >
                    Resume
                </Button>
            }
        />
    );
}

export function ModalArchive({
    campaignId,
    merchantId,
    campaignName,
    trigger,
    onDone,
}: CampaignActionModalProps) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onArchiveClick,
        isPending: isArchiving,
        isError,
    } = useStatusTransition();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Archive campaign"}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Archive size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <>
                    Are you sure you want to archive the campaign{" "}
                    <strong>{campaignName}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"secondary"}
                    loading={isArchiving}
                    disabled={isArchiving}
                    onClick={async () => {
                        await onArchiveClick({
                            campaignId,
                            merchantId,
                            action: "archive",
                        });
                        setOpen(false);
                        onDone?.();
                    }}
                >
                    Archive
                </Button>
            }
        />
    );
}

export function ModalDelete({
    campaignId,
    merchantId,
    campaignName,
    trigger,
    onDone,
}: CampaignActionModalProps) {
    const [open, setOpen] = useState(false);
    const {
        mutateAsync: onDeleteClick,
        isPending: isDeleting,
        isError,
    } = useDeleteCampaign();

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
            title={"Delete campaign"}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Trash2 size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <>
                    Are you sure you want to delete the campaign{" "}
                    <strong>{campaignName}</strong>?
                </>
            }
            text={
                isError ? (
                    <p className={"error"}>An error occurred, try again</p>
                ) : undefined
            }
            cancel={<Button variant={"secondary"}>Cancel</Button>}
            action={
                <Button
                    variant={"destructive"}
                    loading={isDeleting}
                    disabled={isDeleting}
                    onClick={async () => {
                        await onDeleteClick({
                            campaignId,
                            merchantId,
                        });
                        setOpen(false);
                        onDone?.();
                    }}
                >
                    Delete
                </Button>
            }
        />
    );
}
