import { Button } from "@frak-labs/ui/component/Button";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
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
    const setForm = pushCreationStore((state) => state.setForm);
    const navigate = useNavigate();

    const form = useForm<FormCreatePushNotification>({
        values: previousPushCreationForm,
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

            // Save the form in the push creation form
            setForm(data);
            // And go to the confirmation page
            navigate({ to: "/push/confirm" });
        },
        [setForm, navigate]
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
                                    setForm(form.getValues());
                                    // And go back
                                    window.history.back();
                                }}
                            />
                        }
                        right={
                            <Button type={"submit"} variant={"information"}>
                                Next
                            </Button>
                        }
                    />
                </form>
            </Form>
        </FormLayout>
    );
}
