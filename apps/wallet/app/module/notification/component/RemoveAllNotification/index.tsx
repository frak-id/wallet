import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, Settings } from "lucide-react";
import { Trans } from "react-i18next";
import { notificationAdapter } from "@/module/notification/adapter";
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
        <Box>
            <Button
                onClick={async () => {
                    await notificationAdapter.openSettings();
                    await queryClient.invalidateQueries({
                        queryKey: notificationKey.push.permission,
                    });
                }}
            >
                <Inline space="m" alignY="center">
                    <Settings size={20} />
                    <Text>
                        <Trans i18nKey={"wallet.manageNotifications"} />
                    </Text>
                </Inline>
            </Button>
        </Box>
    );
}

function UnsubscribeWeb() {
    const { unsubscribeFromPush, isPending } =
        useUnsubscribeFromPushNotification();

    return (
        <Box>
            <Button onClick={() => unsubscribeFromPush()} disabled={isPending}>
                <Inline space="m" alignY="center">
                    <BellOff size={20} />
                    <Text>Unsubscribe from all notifications</Text>
                </Inline>
            </Button>
        </Box>
    );
}
