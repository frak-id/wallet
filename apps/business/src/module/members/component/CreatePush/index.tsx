import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";
import { pageBottomSpacer } from "@/module/common/component/FloatingFooter/floating-footer.css";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { Form } from "@/module/forms/Form";
import { AudiencePanel } from "@/module/members/component/CreatePush/AudiencePanel";
import { PushCreateLayout } from "@/module/members/component/CreatePush/PushCreateLayout";
import { PushPayloadPanel } from "@/module/members/component/CreatePush/PushPayloadPanel";
import { PushPreview } from "@/module/members/component/CreatePush/PushPreview";
import { PushTitlePanel } from "@/module/members/component/CreatePush/PushTitlePanel";
import { ReviewDialog } from "@/module/members/component/CreatePush/ReviewDialog";
import { SchedulePanel } from "@/module/members/component/CreatePush/SchedulePanel";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import { useSendPushNotification } from "@/module/members/component/CreatePush/useSendPushNotification";
import { pushCreationStore } from "@/stores/pushCreationStore";

const DEFAULT_VALUES: FormCreatePushNotification = {
    pushCampaignTitle: "",
    payload: { title: "", body: "", icon: "", data: { url: "" } },
    targetCount: 0,
    schedule: { type: "", date: "", time: "" },
};

/**
 * Compose and send a push notification — single immersive page with an
 * in-page review modal.
 */
export function CreatePushNotification() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();

    const setForm = pushCreationStore((state) => state.setForm);
    const clearForm = pushCreationStore((state) => state.clearForm);
    // Read the persisted draft once (scoped to this merchant) — reading it
    // reactively would fight react-hook-form's own state on every keystroke.
    const [initialDraft] = useState(() => {
        const state = pushCreationStore.getState();
        return state.draftMerchantId === merchantId
            ? state.currentPushCreationForm
            : undefined;
    });

    const form = useForm<FormCreatePushNotification>({
        mode: "onChange",
        defaultValues: initialDraft ?? DEFAULT_VALUES,
    });

    const values = form.watch();
    const hasContent = Boolean(
        values.pushCampaignTitle ||
            values.payload?.title ||
            values.payload?.body ||
            values.target
    );
    const canPublish = form.formState.isValid && (values.targetCount ?? 0) > 0;

    const sendMutation = useSendPushNotification(merchantId);
    const [reviewOpen, setReviewOpen] = useState(false);

    const onValid = (data: FormCreatePushNotification) => {
        if (data.targetCount === 0) return;
        // Persist the draft so an accidental refresh resumes it.
        setForm(data, merchantId);
        setReviewOpen(true);
    };

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: hasContent,
        onDiscard: clearForm,
    });
    const handleClose = () =>
        guard(() =>
            navigate({ to: "/m/$merchantId/members", params: { merchantId } })
        );

    const preview = (
        <PushPreview
            title={values.payload?.title || t("push.create.preview.title")}
            message={values.payload?.body || t("push.create.preview.message")}
            icon={values.payload?.icon}
        />
    );

    return (
        <Form {...form}>
            <div className={pageBottomSpacer}>
                <PushCreateLayout
                    title={t("push.create.title")}
                    onClose={handleClose}
                    preview={preview}
                >
                    <Stack space={"l"}>
                        <PushTitlePanel />
                        <PushPayloadPanel />
                        <AudiencePanel />
                        <SchedulePanel />
                    </Stack>
                </PushCreateLayout>
            </div>
            <FloatingFooter bare align={"content"}>
                <Button
                    variant={"primary"}
                    size={"large"}
                    width={"auto"}
                    disabled={!canPublish}
                    onClick={form.handleSubmit(onValid)}
                >
                    {t("push.create.publish")}
                </Button>
            </FloatingFooter>
            <ReviewDialog
                open={reviewOpen}
                onOpenChange={(open) => {
                    setReviewOpen(open);
                    // Drop a stale failure so reopening starts clean.
                    if (!open) sendMutation.reset();
                }}
                schedule={values.schedule}
                targetCount={values.targetCount ?? 0}
                isPending={sendMutation.isPending}
                error={sendMutation.error?.message}
                onConfirm={() => sendMutation.mutate(form.getValues())}
            />
            <ConfirmDialog
                open={dialogProps.open}
                onOpenChange={(open) => !open && dialogProps.onKeepEditing()}
                title={t("push.create.leave.title")}
                description={t("push.create.leave.description")}
                cancelLabel={t("push.create.leave.continueEditing")}
                confirmLabel={t("push.create.leave.confirm")}
                confirmTone={"primary"}
                onConfirm={dialogProps.onDiscard}
            />
        </Form>
    );
}
