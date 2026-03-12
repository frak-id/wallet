import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Button } from "@frak-labs/ui/component/Button";
import { notificationAdapter } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, Settings } from "lucide-react";
import { Trans } from "react-i18next";
import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";
import { notificationKey } from "@/module/notification/queryKeys/notification";

/**
 * Native apps: "Manage notifications" → redirect to OS settings.
 * FCM tokens are kept alive; the OS controls permission state.
 *
 * Web apps: "Unsubscribe" → delete push subscription + backend token.
 * Browser subscriptions are locally managed, so deletion is safe.
 */
export function RemoveAllNotification() {
    const { hasLocalCapability } = useNotificationStatus();

    if (!hasLocalCapability) {
        return null;
    }

    if (isTauri()) {
        return <ManageNotificationsNative />;
    }

    return <UnsubscribeWeb />;
}

function ManageNotificationsNative() {
    const queryClient = useQueryClient();

    return (
        <Panel size={"none"} variant={"empty"}>
            <Button
                onClick={async () => {
                    await notificationAdapter.openSettings();
                    await queryClient.invalidateQueries({
                        queryKey: notificationKey.push.permission,
                    });
                }}
                width={"full"}
                align={"left"}
                gap={"big"}
                leftIcon={<Settings size={32} />}
            >
                <ButtonLabel>
                    <Trans i18nKey={"wallet.manageNotifications"} />
                </ButtonLabel>
            </Button>
        </Panel>
    );
}

function UnsubscribeWeb() {
    const { unsubscribeFromPush, isPending } =
        useUnsubscribeFromPushNotification();

    return (
        <Panel size={"none"} variant={"empty"}>
            <Button
                onClick={() => unsubscribeFromPush()}
                disabled={isPending}
                isLoading={isPending}
                width={"full"}
            >
                <Row>
                    <BellOff size={32} /> Unsubscribe from all notifications
                </Row>
            </Button>
        </Panel>
    );
}
