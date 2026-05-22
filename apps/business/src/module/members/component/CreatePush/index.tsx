import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { Button } from "@/module/common/component/Button";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Form, FormLayout } from "@/module/forms/Form";
import { AudiencePanel } from "@/module/members/component/CreatePush/AudiencePanel";
import { PushPayloadPanel } from "@/module/members/component/CreatePush/PushPayloadPanel";
import { PushTitlePanel } from "@/module/members/component/CreatePush/PushTitlePanel";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import { pushCreationStore } from "@/stores/pushCreationStore";

/**
 * Create a push notification
 * @constructor
 */
export function CreatePushNotification() {
    const previousPushCreationForm = pushCreationStore(
        (state) => state.currentPushCreationForm
    );
    const draftMerchantId = pushCreationStore((state) => state.draftMerchantId);
    const setForm = pushCreationStore((state) => state.setForm);
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();

    // Only resume the persisted draft when it belongs to the merchant in
    // the URL. A draft from another merchant would otherwise leak its
    // targeting + payload data into this composer.
    const resumableDraft =
        draftMerchantId === merchantId ? previousPushCreationForm : undefined;

    const form = useForm<FormCreatePushNotification>({
        values: resumableDraft,
        defaultValues: {
            pushCampaignTitle: "",
            payload: {
                title: "",
                body: "",
                icon: "",
                data: {
                    url: "",
                },
            },
        },
    });

    const onSubmit = useCallback(
        async (data: FormCreatePushNotification) => {
            console.log("Submitting push data", { data });

            // If no target is selected, we can't go to the next step
            if (data.targetCount === 0) return;

            // Save the form in the push creation form, scoped to the
            // active merchant so the confirm route can reject drafts
            // that don't belong to the current URL.
            setForm(data, merchantId);
            // And go to the confirmation page
            navigate({
                to: "/m/$merchantId/push/confirm",
                params: { merchantId },
            });
        },
        [setForm, navigate, merchantId]
    );

    return (
        <FormLayout>
            <Head
                title={{
                    content: "Send new push notifications",
                    size: "small",
                }}
                rightSection={
                    <ButtonWithConfirmationAlert
                        description={
                            "Are you sure you want to discard everything related to your new push notification?"
                        }
                        onClick={() => {
                            form.reset();
                            setForm(undefined);
                            // And go to the previous page
                            window.history.back();
                        }}
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <PushTitlePanel />
                    <PushPayloadPanel />
                    <AudiencePanel />
                    <ActionsWrapper
                        left={
                            <ButtonWithConfirmationAlert
                                description={
                                    <>
                                        <p>
                                            Do you want to stop this push
                                            notification campaign creation?
                                        </p>
                                        <p>
                                            You will be able to continue it's
                                            creation later
                                        </p>
                                    </>
                                }
                                title={"Close"}
                                buttonText={"Close"}
                                onClick={() => {
                                    // Save the current form state
                                    // (scoped to the active merchant)
                                    setForm(form.getValues(), merchantId);
                                    // And go back
                                    window.history.back();
                                }}
                            />
                        }
                        right={
                            <Button type={"submit"} variant={"secondary"}>
                                Next
                            </Button>
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
