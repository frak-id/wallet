import { CancelButtonWithAlert } from "@/module/common/component/CancelButtonWithAlert";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
import { FormLayout } from "@/module/forms/Form";
import { AudiencePanel } from "@/module/members/component/CreatePush/AudiencePanel";
import type { NotificationPayload } from "@frak-labs/shared/types/NotificationPayload";
import { Form, useForm } from "react-hook-form";
import type { Address } from "viem";

type CreatePushNotificationForm = {
    pushCampaignTitle?: string;
    payload?: NotificationPayload;
    audience: Address[];
};

/**
 * Create a push notification
 * @constructor
 */
export function CreatePushNotification() {
    const form = useForm<CreatePushNotificationForm>({
        defaultValues: {
            pushCampaignTitle: undefined,
            payload: undefined,
            audience: [],
        },
    });

    return (
        <FormLayout>
            <Head
                title={{
                    content: "Send new push notifications",
                    size: "small",
                }}
                rightSection={
                    <CancelButtonWithAlert
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
                <Panel title={"Push Notification Title"}>
                    {/*    todo: Push campaign title*/}
                </Panel>
                <Panel title={"Message"}>
                    {/*    todo: message form + live preview*/}
                </Panel>
                <AudiencePanel />
            </Form>
        </FormLayout>
    );
}
