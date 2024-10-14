"use client";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { backendApi } from "@frak-labs/shared/context/server";
import { jotaiStore } from "@module/atoms/store";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

function cleanLocalStorage() {
    const localStorageItems = ["theme", "REACT_QUERY_OFFLINE_CACHE"];
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
            >
                <Row>
                    <LogOut size={32} /> Logout
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
