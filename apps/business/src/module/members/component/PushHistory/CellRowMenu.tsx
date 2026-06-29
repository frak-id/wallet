import { Text } from "@frak-labs/design-system/components/Text";
import { BinIcon, PencilIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { startOfDay } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { RowMenu, RowMenuItem } from "@/module/common/component/RowMenu";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type {
    FormCreatePushNotification,
    PushSchedule,
} from "@/module/members/component/CreatePush/types";
import { pushCreationStore } from "@/stores/pushCreationStore";
import type { PushHistoryItem } from "./types";
import { useDeletePushBroadcast } from "./usePushHistory";

/**
 * Rebuild the composer's schedule fields from a scheduled broadcast's delivery
 * timestamp: the `date` is the local-midnight ISO day (matching DateField) and
 * `time` is local `HH:mm` (matching deriveScheduledAt).
 */
function scheduleFromItem(item: PushHistoryItem): PushSchedule {
    if (item.status !== "scheduled") {
        return { type: "now", date: "", time: "" };
    }
    const delivery = new Date(item.scheduledAt);
    const pad = (value: number) => String(value).padStart(2, "0");
    return {
        type: "later",
        date: startOfDay(delivery).toISOString(),
        time: `${pad(delivery.getHours())}:${pad(delivery.getMinutes())}`,
    };
}

/**
 * Build a composer draft from a history row so "Edit" resumes the creation
 * flow fully prefilled (campaign name, notification content, audience and
 * delivery time). `editingId` flags it as an update of the existing broadcast.
 */
function itemToDraft(item: PushHistoryItem): FormCreatePushNotification {
    return {
        editingId: item.id,
        pushCampaignTitle: item.title,
        payload: {
            title: item.payload.title,
            body: item.payload.body,
            icon: item.payload.icon ?? "",
            data: { url: item.payload.url ?? "" },
        },
        target: item.target,
        targetCount: item.targetCount,
        schedule: scheduleFromItem(item),
    };
}

/**
 * Per-row actions for a push broadcast: edit (scheduled rows only) and delete.
 */
export function CellRowMenu({ item }: { item: PushHistoryItem }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const setForm = pushCreationStore((state) => state.setForm);
    const deleteMutation = useDeletePushBroadcast(merchantId);
    // Sent notifications are immutable history: no edit, no delete. Only
    // pending scheduled broadcasts can be changed or removed.
    const canModify = item.status === "scheduled";

    function handleEdit() {
        setForm(itemToDraft(item), merchantId);
        navigate({ to: "/m/$merchantId/push/create", params: { merchantId } });
    }

    if (!canModify) {
        return null;
    }

    return (
        <>
            <RowMenu
                ariaLabel={t("push.history.rowMenu.aria", {
                    title: item.title,
                })}
            >
                {({ close }) => (
                    <>
                        <RowMenuItem
                            icon={<PencilIcon width={16} height={16} />}
                            onClick={() => {
                                close();
                                handleEdit();
                            }}
                        >
                            {t("push.history.rowMenu.edit")}
                        </RowMenuItem>
                        <RowMenuItem
                            destructive
                            icon={<BinIcon width={16} height={16} />}
                            onClick={() => {
                                close();
                                setDeleteOpen(true);
                            }}
                        >
                            {t("push.history.rowMenu.delete")}
                        </RowMenuItem>
                    </>
                )}
            </RowMenu>
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={(open) => {
                    setDeleteOpen(open);
                    // Drop a stale failure so reopening starts clean.
                    if (!open) deleteMutation.reset();
                }}
                title={t("push.history.delete.title")}
                description={t("push.history.delete.description", {
                    title: item.title,
                })}
                cancelLabel={t("push.history.delete.cancel")}
                confirmLabel={t("push.history.delete.confirm")}
                confirmTone={"destructive"}
                isConfirming={deleteMutation.isPending}
                error={
                    deleteMutation.isError ? (
                        <Text variant="caption" color="error">
                            {t("push.history.delete.error")}
                        </Text>
                    ) : undefined
                }
                onConfirm={() => {
                    deleteMutation.mutate(item.id, {
                        // Keep the dialog open on failure so the error surfaces
                        // and the user can retry; only close once the delete
                        // actually resolves.
                        onSuccess: () => setDeleteOpen(false),
                    });
                }}
            />
        </>
    );
}
