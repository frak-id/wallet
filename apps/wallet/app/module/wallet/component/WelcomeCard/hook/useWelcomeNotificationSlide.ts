import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { notificationAdapter } from "@/module/notification/adapter";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useSubscribeToPushNotification } from "@/module/notification/hook/useSubscribeToPushNotification";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import type { NotificationWelcomeSlide } from "../utils/types";

export function useWelcomeNotificationSlide(): NotificationWelcomeSlide | null {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const isNativeApp = isTauri();
    const { permissionStatus, isReady, hasLocalCapability } =
        useNotificationStatus();
    const { subscribeToPush, isPending: isSubscribePending } =
        useSubscribeToPushNotification();

    if (
        !isReady ||
        hasLocalCapability ||
        (permissionStatus === "denied" && !isNativeApp)
    ) {
        return null;
    }

    return {
        id: "notifications",
        kind: "notifications",
        title: t("wallet.welcome.notifications.title"),
        actionI18nKey:
            permissionStatus === "denied"
                ? "wallet.openNotificationSettings"
                : permissionStatus === "prompt-with-rationale"
                  ? "wallet.activateNotificationsRationale"
                  : "wallet.activateNotifications",
        onAction:
            permissionStatus === "denied"
                ? async () => {
                      await notificationAdapter.openSettings();
                      await queryClient.invalidateQueries({
                          queryKey: notificationKey.push.permission,
                      });
                  }
                : () => subscribeToPush(),
        isActionPending:
            permissionStatus === "denied" ? false : isSubscribePending,
    };
}
