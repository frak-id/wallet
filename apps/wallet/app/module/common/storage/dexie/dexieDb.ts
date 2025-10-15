import type { Table } from "dexie";
import { Dexie } from "dexie";
import type { NotificationModel } from "@/module/common/storage/dexie/NotificationModel";
import type { PreviousAuthenticatorModel } from "@/module/common/storage/dexie/PreviousAuthenticatorModel";

class WalletDB extends Dexie {
    // This table will be used to store all the authenticator a user as used on his device
    previousAuthenticator!: Table<PreviousAuthenticatorModel>;

    // This table will be used to store all the notifications a user has received
    notification!: Table<NotificationModel>;

    constructor() {
        super("frak-wallet-db");
        this.version(1).stores({
            previousAuthenticator: "&wallet,authenticatorId",
            notification: "&id",
        });
    }
}

export const dexieDb = new WalletDB();
