import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { usePrivyContext } from "@/module/common/provider/PrivyProvider";
import { jotaiStore } from "@module/atoms/store";
import { Button } from "@module/component/Button";
import { useQueryClient } from "@tanstack/react-query";
import { RESET } from "jotai/utils";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

function cleanLocalStorage() {
    // Clear static local storage items
    const localStorageItems = [
        "REACT_QUERY_OFFLINE_CACHE",
        "frak_theme",
        "frak_session",
        "frak_sdkSession",
        "frak_interactionSession",
        "frak_lastWebAuthNAction",
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
    const { logout: privyLogout } = usePrivyContext();

    return (
        <Panel size={"none"} variant={"invisible"}>
            <Button
                blur={"blur"}
                width={"full"}
                align={"left"}
                onClick={async () => {
                    // Privy logout
                    await privyLogout();
                    // Session deletion
                    jotaiStore.set(sessionAtom, RESET);
                    jotaiStore.set(sdkSessionAtom, RESET);
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
