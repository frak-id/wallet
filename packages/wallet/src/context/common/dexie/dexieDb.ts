"use client";

import type { ArticleInfoModel } from "@/context/common/dexie/ArticleInfoModel";
import { DI } from "@/context/common/di";
import type { Table } from "dexie";
import { Dexie } from "dexie";

export class WalletDB extends Dexie {
    // This table will be used to fetch article link from articleId + contetId in the history
    articleInfo!: Table<ArticleInfoModel>;

    constructor() {
        super("walletDatabase");
        this.version(1).stores({
            articleInfo: "[articleId+contentId]",
        });
    }
}

export const getDexieDb = DI.registerAndExposeGetter({
    id: "dexieDb",
    getter: async () => {
        const db = new WalletDB();
        await db.open();
        return db;
    },
    isAsync: true,
});
