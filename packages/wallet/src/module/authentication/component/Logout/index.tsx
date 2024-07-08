"use client";

import { deleteSession } from "@/context/session/action/session";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

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
    const router = useRouter();
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
                        router.push("/register");
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
