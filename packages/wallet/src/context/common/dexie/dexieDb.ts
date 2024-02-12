"use client";

import type { ArticleInfoModel } from "@/context/common/dexie/ArticleInfoModel";
import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { DI } from "@/context/common/di";
import type { Table } from "dexie";
import { Dexie } from "dexie";

export class WalletDB extends Dexie {
    // This table will be used to fetch article link from articleId + contentId in the history
    articleInfo!: Table<ArticleInfoModel>;
    // This table will be used to fetch article link from articleId + contetId in the history
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

export const getDexieDb = DI.registerAndExposeGetter({
    id: "dexieDb",
    getter: async () => {
        const db = new WalletDB();
        await db.open();
        return db;
    },
    isAsync: true,
});
