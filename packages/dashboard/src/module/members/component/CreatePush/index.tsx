"use client";

import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { AudiencePanel } from "@/module/members/component/CreatePush/AudiencePanel";
import { PushPayloadPanel } from "@/module/members/component/CreatePush/PushPayloadPanel";
import { PushTitlePanel } from "@/module/members/component/CreatePush/PushTitlePanel";
import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import type { Address } from "viem";

export type FormCreatePushNotification = {
    pushCampaignTitle: string;
    payload: NotificationPayload;
    audience: Address[];
};

/**
 * Create a push notification
 * @constructor
 */
export function CreatePushNotification() {
    const form = useForm<FormCreatePushNotification>({
        defaultValues: {
            pushCampaignTitle: "",
            payload: {
                title: "",
                body: "",
                data: {
                    url: "",
                },
            },
            audience: [],
        },
    });

    const onSubmit = useCallback(async (data: FormCreatePushNotification) => {
        console.log("Submitting push data", {data})
        // todo: Do some shit here
    }, []);

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
                            window.location.href = "/members";
                        }}
                    />
                }
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <PushTitlePanel
                        control={form.control}
                        name={"pushCampaignTitle"}
                    />
                    <PushPayloadPanel control={form.control} name={"payload"} />
                    <AudiencePanel />
                </form>
            </Form>
        </FormLayout>
    );
}
