import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";

type DiscardChangesDialogProps = {
    open: boolean;
    onKeepEditing: () => void;
    onDiscard: () => void;
};

export function DiscardChangesDialog({
    open,
    onKeepEditing,
    onDiscard,
}: DiscardChangesDialogProps) {
    const { t } = useTranslation();

    return (
        <ConfirmDialog
            open={open}
            onOpenChange={(o) => !o && onKeepEditing()}
            title={t("merchantEdit.discard.title")}
            description={t("merchantEdit.discard.description")}
            cancelLabel={t("merchantEdit.discard.keepEditing")}
            confirmLabel={t("merchantEdit.discard.confirm")}
            confirmTone="destructive"
            onConfirm={onDiscard}
        />
    );
}
