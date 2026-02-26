import { Button } from "@frak-labs/ui/component/Button";
import { sessionStore, trackGenericEvent } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel, panelDismissedPrefix } from "@/module/common/component/Panel";

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

    return (
        <Panel size={"none"} variant={"invisible"}>
            <Button
                blur={"blur"}
                width={"full"}
                align={"left"}
                onClick={async () => {
                    trackGenericEvent("logout");
                    // Session deletion
                    sessionStore.getState().clearSession();
                    sessionStore.getState().clearSession();
                    // Query cache
                    queryClient.removeQueries();
                    // Local storage cleanup
                    setTimeout(() => {
                        cleanLocalStorage();
                        navigate({ to: "/register" });
                    }, 100);
                }}
                leftIcon={<LogOut size={32} />}
            >
                {t("common.logout")}
            </Button>
        </Panel>
    );
}
