"use client";

import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import type { Table } from "dexie";
import { Dexie } from "dexie";

class WalletDB extends Dexie {
    // This table will be used to store all the authenticator a user as used on his device
    previousAuthenticator!: Table<PreviousAuthenticatorModel>;

    constructor() {
        super("walletDatabase");
        this.version(1).stores({
            previousAuthenticator: "&wallet,authenticatorId",
        });
    }
}

export const dexieDb = new WalletDB();
