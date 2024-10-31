import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { Notifications } from "@module/asset/icons/Notifications";
import { Button } from "@module/component/Button";
import { Trans } from "react-i18next";
import { useNotificationSetupStatus } from "../../hook/useNotificationSetupStatus";

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
                leftIcon={<Notifications />}
            >
                <ButtonLabel>
                    <Trans i18nKey={"wallet.activateNotifications"} />
                </ButtonLabel>
            </Button>
        </Panel>
    );
}
