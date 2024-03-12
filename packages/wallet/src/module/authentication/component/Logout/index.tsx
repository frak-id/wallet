"use client";

import { deleteSession } from "@/context/session/action/session";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

function cleanLocalStorage() {
    const localStorageItems = [
        "theme",
        "paywallContext",
        "paywallStatus",
        "REACT_QUERY_OFFLINE_CACHE",
    ];
    localStorageItems.map((item) => window.localStorage.removeItem(item));
}

/**
 * Logout from current authentication
 * @constructor
 */
export function Logout() {
    const queryClient = useQueryClient();
    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={async () => {
                    await deleteSession();
                    queryClient.removeQueries();
                    setTimeout(() => {
                        cleanLocalStorage();
                    }, 100);
                }}
            >
                <Row>
                    <LogOut size={32} /> Logout
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
