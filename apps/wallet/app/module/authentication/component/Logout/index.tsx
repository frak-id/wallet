import { Button } from "@frak-labs/ui/component/Button";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Panel } from "@/module/common/component/Panel";
import { trackGenericEvent } from "../../../common/analytics";

function cleanLocalStorage() {
    // Clear static local storage items
    const localStorageItems = [
        "REACT_QUERY_OFFLINE_CACHE",
        "frak_theme",
        "frak_session",
        "frak_sdkSession",
        "frak_interactionSession",
        "frak_lastWebAuthNAction",
        "frak_user",
        "frak_userSetupLater",
    ];
    localStorageItems.map((item) => window.localStorage.removeItem(item));
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
                        navigate("/register", { viewTransition: true });
                    }, 100);
                }}
                leftIcon={<LogOut size={32} />}
            >
                {t("common.logout")}
            </Button>
        </Panel>
    );
}
