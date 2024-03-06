"use client";

import { deleteSession } from "@/context/session/action/session";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { LogOut } from "lucide-react";

function cleanLocalStorage() {
    const localStorageItems = ["theme", "paywallContext", "paywallStatus"];
    localStorageItems.map((item) => window.localStorage.removeItem(item));
}

/**
 * Logout from current authentication
 * @constructor
 */
export function Logout() {
    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={() => {
                    deleteSession();
                    cleanLocalStorage();
                }}
            >
                <Row>
                    <LogOut size={32} /> Logout
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
