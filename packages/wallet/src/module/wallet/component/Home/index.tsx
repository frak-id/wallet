"use client";

import { deleteSession } from "@/context/session/action/session";

export function WalletHomePage() {
    return (
        <div>
            <h1>I'm logged in</h1>

            <button
                type={"button"}
                onClick={() => {
                    deleteSession();
                }}
            >
                Log out
            </button>
        </div>
    );
}
