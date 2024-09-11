"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { BellRing } from "lucide-react";

export function EnableNotification() {
    const { isSupported, subscription } = useNotificationSetupStatus();

    const { subscribeToPush, isPending } = useSubscribeToPushNotification();

    // If not supported, or already got a subscription, return nothing
    if (!isSupported || subscription) {
        return null;
    }

    // Otherwise, button to subscribe to the notification
    return (
        <Panel variant={"empty"} size={"none"}>
            <ButtonRipple
                size={"small"}
                onClick={subscribeToPush}
                disabled={isPending}
                isLoading={isPending}
            >
                <Title icon={<BellRing width={32} height={32} />}>
                    Enable <strong>Notification</strong> for a better
                    experience!
                </Title>
            </ButtonRipple>
        </Panel>
    );
}
