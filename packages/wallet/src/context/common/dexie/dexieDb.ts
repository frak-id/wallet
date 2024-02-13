"use client";

import type { ArticleInfoModel } from "@/context/common/dexie/ArticleInfoModel";
import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import type { Table } from "dexie";
import { Dexie } from "dexie";

export class WalletDB extends Dexie {
    // This table will be used to fetch article link from articleId + contentId in the history
    articleInfo!: Table<ArticleInfoModel>;
    // This table will be used to store all the authenticator a user as used on his device
    previousAuthenticator!: Table<PreviousAuthenticatorModel>;

    constructor() {
        super("walletDatabase");
        this.version(1).stores({
            articleInfo: "&[articleId+contentId]",
            previousAuthenticator: "&wallet,authenticatorId",
        });
    }
}

export const dexieDb = new WalletDB();
