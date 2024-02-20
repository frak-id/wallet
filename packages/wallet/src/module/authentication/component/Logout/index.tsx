"use client";

import { deleteSession } from "@/context/session/action/session";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { LogOut } from "lucide-react";

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
                }}
            >
                <Row>
                    <LogOut size={32} /> Logout
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
