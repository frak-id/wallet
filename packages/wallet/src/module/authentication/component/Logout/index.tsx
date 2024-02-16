"use client";

import { deleteSession } from "@/context/session/action/session";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { LogOut } from "lucide-react";
import styles from "./index.module.css";

/**
 * Logout from current authentication
 * @constructor
 */
export function Logout() {
    return (
        <Panel withShadow={true} size={"small"}>
            <button
                type={"button"}
                className={styles.logout}
                onClick={() => {
                    deleteSession();
                }}
            >
                <Row>
                    <LogOut size={32} /> Logout
                </Row>
            </button>
        </Panel>
    );
}
