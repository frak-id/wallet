import { Button } from "@frak-labs/ui/component/Button";
import { NotificationsMobile } from "@frak-labs/ui/icons/NotificationsMobile";
import { notificationAdapter } from "@frak-labs/wallet-shared";
import { Trans } from "react-i18next";
import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";

export function EnableNotification() {
    const { permissionStatus, hasLocalCapability } = useNotificationStatus();
    const { subscribeToPush, isPending } = useSubscribeToPushNotification();

    if (hasLocalCapability) {
        return null;
    }

    if (permissionStatus === "denied") {
        return (
            <Panel variant={"invisible"} size={"none"}>
                <Button
                    blur={"blur"}
                    width={"full"}
                    align={"left"}
                    gap={"big"}
                    onClick={() => notificationAdapter.openSettings()}
                    leftIcon={<NotificationsMobile />}
                >
                    <ButtonLabel>
                        <Trans i18nKey={"wallet.openNotificationSettings"} />
                    </ButtonLabel>
                </Button>
            </Panel>
        );
    }

    const i18nKey =
        permissionStatus === "prompt-with-rationale"
            ? "wallet.activateNotificationsRationale"
            : "wallet.activateNotifications";

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
                    <Trans i18nKey={i18nKey} />
                </ButtonLabel>
            </Button>
        </Panel>
    );
}
