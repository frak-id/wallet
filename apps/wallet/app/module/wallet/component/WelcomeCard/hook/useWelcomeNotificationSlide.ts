import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import type { NotificationWelcomeSlide } from "../utils/types";

export function useWelcomeNotificationSlide(): NotificationWelcomeSlide | null {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isReady, hasLocalCapability } = useNotificationStatus();

    if (!isReady || hasLocalCapability) {
        return null;
    }

    return {
        id: "notifications",
        kind: "notifications",
        title: t("wallet.welcome.notifications.title"),
        actionI18nKey: "wallet.activateNotifications",
        onAction: () => navigate({ to: "/profile" }),
    };
}
