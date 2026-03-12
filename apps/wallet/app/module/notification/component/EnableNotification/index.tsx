import { Button } from "@frak-labs/ui/component/Button";
import { NotificationsMobile } from "@frak-labs/ui/icons/NotificationsMobile";
import { Trans } from "react-i18next";
import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";

export function EnableNotification() {
    const { isSupported, hasLocalCapability } = useNotificationStatus();
    const { subscribeToPush, isPending } = useSubscribeToPushNotification();

    if (!isSupported || hasLocalCapability) {
        return null;
    }

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
