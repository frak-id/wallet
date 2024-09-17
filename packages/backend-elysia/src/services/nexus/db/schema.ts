import {
    index,
    pgTable,
    serial,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";

/**
 * Table storing the push tokens used for the notifications
 */
export const pushTokens = pgTable(
    "push_tokens",
    {
        id: serial("id").primaryKey(),
        wallet: varchar("wallet", { length: 255 }).notNull().$type<Address>(),
        endpoint: varchar("endpoint").notNull(),
        keyP256dh: varchar("key_p256dh").notNull(),
        keyAuth: varchar("key_auth").notNull(),
        expireAt: timestamp("expire_at"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => ({
        walletIdx: index("wallet_idx").on(table.wallet),
        unqPushToken: unique("unique_push_token").on(
            table.wallet,
            table.endpoint,
            table.keyP256dh
        ),
    })
);
