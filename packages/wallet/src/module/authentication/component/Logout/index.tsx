"use client";

import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { backendApi } from "@frak-labs/shared/context/server";
import { jotaiStore } from "@module/atoms/store";
import { Button } from "@module/component/Button";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

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
    const router = useRouter();
    const queryClient = useQueryClient();
    return (
        <Panel size={"none"} variant={"invisible"}>
            <Button
                blur={"blur"}
                width={"full"}
                align={"left"}
                onClick={async () => {
                    // Session deletion
                    await backendApi.auth.wallet.logout.post();
                    jotaiStore.set(sessionAtom, null);
                    jotaiStore.set(sdkSessionAtom, null);
                    // Query cache
                    queryClient.removeQueries();
                    // Local storage cleanup
                    setTimeout(() => {
                        cleanLocalStorage();
                        router.push("/register");
                    }, 100);
                }}
                leftIcon={<LogOut size={32} />}
            >
                {t("common.logout")}
            </Button>
        </Panel>
    );
}
