import { BinIcon, PencilIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { RowMenu, RowMenuItem } from "@/module/common/component/RowMenu";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import { pushCreationStore } from "@/stores/pushCreationStore";
import type { PushHistoryItem } from "./types";
import { useDeletePushBroadcast } from "./usePushHistory";

/**
 * Build a composer draft from a history row so "Edit" resumes the creation
 * flow fully prefilled (campaign name, notification content, audience).
 * Scheduling stays `now` — delayed delivery isn't wired yet (see CreatePush).
 */
function itemToDraft(item: PushHistoryItem): FormCreatePushNotification {
    return {
        pushCampaignTitle: item.title,
        payload: {
            title: item.payload.title,
            body: item.payload.body,
            icon: item.payload.icon ?? "",
            data: { url: item.payload.url ?? "" },
        },
        target: item.target,
        targetCount: item.targetCount,
        schedule: { type: "now", date: "", time: "" },
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
    const canEdit = item.status === "scheduled";

    function handleEdit() {
        setForm(itemToDraft(item), merchantId);
        navigate({ to: "/m/$merchantId/push/create", params: { merchantId } });
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
                        {canEdit && (
                            <RowMenuItem
                                icon={<PencilIcon width={16} height={16} />}
                                onClick={() => {
                                    close();
                                    handleEdit();
                                }}
                            >
                                {t("push.history.rowMenu.edit")}
                            </RowMenuItem>
                        )}
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
                onOpenChange={setDeleteOpen}
                title={t("push.history.delete.title")}
                description={t("push.history.delete.description", {
                    title: item.title,
                })}
                cancelLabel={t("push.history.delete.cancel")}
                confirmLabel={t("push.history.delete.confirm")}
                confirmTone={"destructive"}
                onConfirm={() => {
                    deleteMutation.mutate(item.id);
                    setDeleteOpen(false);
                }}
            />
        </>
    );
}
