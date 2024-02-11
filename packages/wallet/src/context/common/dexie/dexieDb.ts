"use client";

import type { ArticleInfoModel } from "@/context/common/dexie/ArticleInfoModel";
import type { Table } from "dexie";
import { Dexie } from "dexie";

export class WalletDB extends Dexie {
    // This table will be used to fetch article link from articleId + contetId in the history
    articleInfo!: Table<ArticleInfoModel, number>;

    constructor() {
        super("WalletDb");
        this?.version(1)?.stores({
            articleInfo: "++id, [articleId,contentId]",
        });
    }
}

export const dexieDb = new WalletDB();
