"use client";

import { deleteSession } from "@/context/session/action/session";
import styles from "./index.module.css";

/**
 * Logout from current authentication
 * @constructor
 */
export function Logout() {
    return (
        <button
            type={"button"}
            className={styles.logout}
            onClick={() => {
                deleteSession();
            }}
        >
            Log out
        </button>
    );
}
