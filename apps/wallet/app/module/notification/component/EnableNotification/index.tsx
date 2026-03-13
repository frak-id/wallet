import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Button } from "@frak-labs/ui/component/Button";
import { NotificationsMobile } from "@frak-labs/ui/icons/NotificationsMobile";
import { useQueryClient } from "@tanstack/react-query";
import { Trans } from "react-i18next";
import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { notificationAdapter } from "@/module/notification/adapter";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { notificationKey } from "@/module/notification/queryKeys/notification";

export function EnableNotification() {
    const { permissionStatus, hasLocalCapability } = useNotificationStatus();
    const { subscribeToPush, isPending } = useSubscribeToPushNotification();
    const queryClient = useQueryClient();

    if (hasLocalCapability) {
        return null;
    }

    // On web, browsers don't expose a way to re-prompt after denial — hide entirely.
    // On native, redirect to OS notification settings.
    if (permissionStatus === "denied") {
        if (!isTauri()) {
            return null;
        }

        return (
            <Panel variant={"invisible"} size={"none"}>
                <Button
                    blur={"blur"}
                    width={"full"}
                    align={"left"}
                    gap={"big"}
                    onClick={async () => {
                        await notificationAdapter.openSettings();
                        await queryClient.invalidateQueries({
                            queryKey: notificationKey.push.permission,
                        });
                    }}
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
