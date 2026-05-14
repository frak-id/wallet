import {
    recoveryHintStorage,
    sessionStore,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { panelDismissedPrefix } from "@/module/common/component/Panel";
import { notificationAdapter } from "@/module/notification/adapter";

function cleanLocalStorage() {
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
    for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(panelDismissedPrefix)) {
            window.localStorage.removeItem(key);
        }
    }
}

/**
 * Full logout flow: unsubscribe push, wipe recovery hint, clear session
 * + demo private key, drain query cache, scrub local storage, redirect
 * to `/register`.
 */
export function useLogout() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const logout = useCallback(async () => {
        setIsLoggingOut(true);
        trackEvent("logout");
        await notificationAdapter.unsubscribe().catch(() => {});
        await recoveryHintStorage.clear();
        sessionStore.getState().clearSession();
        queryClient.removeQueries();
        setTimeout(() => {
            cleanLocalStorage();
            navigate({ to: "/register", replace: true });
        }, 100);
    }, [navigate, queryClient]);

    return { logout, isLoggingOut };
}
