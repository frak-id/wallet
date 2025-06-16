import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { useNotificationSetupStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { Button } from "@frak-labs/ui/component/Button";
import { NotificationsMobile } from "@frak-labs/ui/icons/NotificationsMobile";
import { Trans } from "react-i18next";

export function EnableNotification() {
    const { isSupported, subscription } = useNotificationSetupStatus();
    const { subscribeToPush, isPending } = useSubscribeToPushNotification();

    // If not supported, or already got a subscription, return nothing
    if (!isSupported || subscription) {
        return null;
    }

    // Otherwise, button to subscribe to the notification
    return (
        <Panel variant={"invisible"} size={"none"}>
            <Button
                blur={"blur"}
                width={"full"}
                align={"left"}
                gap={"big"}
                onClick={() => subscribeToPush()}
                disabled={isPending}
                isLoading={isPending}
                leftIcon={<NotificationsMobile />}
            >
                <ButtonLabel>
                    <Trans i18nKey={"wallet.activateNotifications"} />
                </ButtonLabel>
            </Button>
        </Panel>
    );
}
