"use client";

import { deleteSession } from "@/context/session/action/session";

/**
 * Logout from current authentication
 * @constructor
 */
export function Logout() {
    return (
        <button
            type={"button"}
            onClick={() => {
                deleteSession();
            }}
        >
            Log out
        </button>
    );
}
