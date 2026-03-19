import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Trans } from "react-i18next";
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
            <Box>
                <Button
                    onClick={async () => {
                        await notificationAdapter.openSettings();
                        await queryClient.invalidateQueries({
                            queryKey: notificationKey.push.permission,
                        });
                    }}
                    disabled={false}
                >
                    <Inline space="m" alignY="center">
                        <Bell size={20} />
                        <Text>
                            <Trans
                                i18nKey={"wallet.openNotificationSettings"}
                            />
                        </Text>
                    </Inline>
                </Button>
            </Box>
        );
    }

    const i18nKey =
        permissionStatus === "prompt-with-rationale"
            ? "wallet.activateNotificationsRationale"
            : "wallet.activateNotifications";

    return (
        <Box>
            <Button onClick={() => subscribeToPush()} disabled={isPending}>
                <Inline space="m" alignY="center">
                    <Bell size={20} />
                    <Text>
                        <Trans i18nKey={i18nKey} />
                    </Text>
                </Inline>
            </Button>
        </Box>
    );
}
