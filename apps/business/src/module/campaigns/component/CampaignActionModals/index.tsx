import { Archive, Pause, Play, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
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
    const { t } = useTranslation();
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
            title={t("campaigns.actions.pauseTitle")}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Pause size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <Trans
                    i18nKey="campaigns.actions.confirmPause"
                    values={{ name: campaignName }}
                    components={{ strong: <strong /> }}
                />
            }
            text={
                isError ? (
                    <p className={"error"}>{t("campaigns.actions.error")}</p>
                ) : undefined
            }
            cancel={
                <Button variant={"secondary"}>
                    {t("campaigns.actions.cancel")}
                </Button>
            }
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
                    {t("campaigns.actions.pause")}
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
    const { t } = useTranslation();
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
            title={t("campaigns.actions.resumeTitle")}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Play size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <Trans
                    i18nKey="campaigns.actions.confirmResume"
                    values={{ name: campaignName }}
                    components={{ strong: <strong /> }}
                />
            }
            text={
                isError ? (
                    <p className={"error"}>{t("campaigns.actions.error")}</p>
                ) : undefined
            }
            cancel={
                <Button variant={"secondary"}>
                    {t("campaigns.actions.cancel")}
                </Button>
            }
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
                    {t("campaigns.actions.resume")}
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
    const { t } = useTranslation();
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
            title={t("campaigns.actions.archiveTitle")}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Archive size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <Trans
                    i18nKey="campaigns.actions.confirmArchive"
                    values={{ name: campaignName }}
                    components={{ strong: <strong /> }}
                />
            }
            text={
                isError ? (
                    <p className={"error"}>{t("campaigns.actions.error")}</p>
                ) : undefined
            }
            cancel={
                <Button variant={"secondary"}>
                    {t("campaigns.actions.cancel")}
                </Button>
            }
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
                    {t("campaigns.actions.archive")}
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
    const { t } = useTranslation();
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
            title={t("campaigns.actions.deleteTitle")}
            buttonElement={
                trigger ?? (
                    <button type={"button"}>
                        <Trash2 size={20} absoluteStrokeWidth={true} />
                    </button>
                )
            }
            description={
                <Trans
                    i18nKey="campaigns.actions.confirmDelete"
                    values={{ name: campaignName }}
                    components={{ strong: <strong /> }}
                />
            }
            text={
                isError ? (
                    <p className={"error"}>{t("campaigns.actions.error")}</p>
                ) : undefined
            }
            cancel={
                <Button variant={"secondary"}>
                    {t("campaigns.actions.cancel")}
                </Button>
            }
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
                    {t("campaigns.actions.delete")}
                </Button>
            }
        />
    );
}
