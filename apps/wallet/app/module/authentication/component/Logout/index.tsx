import { Button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { sessionStore, trackEvent } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { panelDismissedPrefix } from "@/module/common/component/Panel";
import { notificationAdapter } from "@/module/notification/adapter";
import * as styles from "./index.css";

function cleanLocalStorage() {
    // Clear static local storage items
    const localStorageItems = [
        "REACT_QUERY_OFFLINE_CACHE",
        "frak_theme",
        "frak_session",
        "frak_sdkSession",
        "frak_lastWebAuthNAction",
        "frak_user",
        "frak_userSetupLater",
    ];
    for (const item of localStorageItems) {
        window.localStorage.removeItem(item);
    }

    // Clear all dismissed panel states
    for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(panelDismissedPrefix)) {
            window.localStorage.removeItem(key);
        }
    }
}

/**
 * Logout from current authentication
 * @constructor
 */
export function Logout() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        trackEvent("logout");
        // Unsubscribe from push notifications before clearing session (needs auth)
        await notificationAdapter.unsubscribe().catch(() => {});
        // Session deletion
        sessionStore.getState().clearSession();
        // Query cache
        queryClient.removeQueries();
        // Local storage cleanup
        setTimeout(() => {
            cleanLocalStorage();
            navigate({ to: "/register" });
        }, 100);
    };

    return (
        <Button
            disabled={isLoggingOut}
            onClick={handleLogout}
            icon={isLoggingOut ? <Spinner size="s" /> : <LogOut size={20} />}
            className={styles.logoutButton}
        >
            {t("common.logout")}
        </Button>
    );
}
