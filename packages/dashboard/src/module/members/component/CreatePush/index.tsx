"use client";

import { ActionsWrapper } from "@/module/common/component/ActionsWrapper";
import { ButtonWithConfirmationAlert } from "@/module/common/component/ButtonWithConfirmationAlert";
import { Head } from "@/module/common/component/Head";
import { Form, FormLayout } from "@/module/forms/Form";
import { AudiencePanel } from "@/module/members/component/CreatePush/AudiencePanel";
import { PushPayloadPanel } from "@/module/members/component/CreatePush/PushPayloadPanel";
import { PushTitlePanel } from "@/module/members/component/CreatePush/PushTitlePanel";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";
import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import { Button } from "@module/component/Button";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import type { Address } from "viem";

export type FormCreatePushNotification = {
    pushCampaignTitle: string;
    payload: NotificationPayload;
    target?:
        | {
              wallets: Address[];
          }
        | {
              filter: FormMembersFiltering;
          };
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
        },
    });

    const onSubmit = useCallback(async (data: FormCreatePushNotification) => {
        console.log("Submitting push data", { data });
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
                                    // todo: Should backup in local storage to be able to resume it's creation later
                                    form.reset();
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
