import {
    index,
    pgTable,
    serial,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

export type PushTokenType = "web-push" | "fcm";

/**
 * Table storing the push tokens used for notifications.
 * Supports both Web Push subscriptions (endpoint + keys) and FCM registration tokens (endpoint only).
 */
export const pushTokensTable = pgTable(
    "push_tokens",
    {
        id: serial("id").primaryKey(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        type: varchar("type", { length: 16 })
            .notNull()
            .default("web-push")
            .$type<PushTokenType>(),
        /** For web-push: push service endpoint URL. For FCM: registration token string. */
        endpoint: varchar("endpoint").notNull(),
        /** P-256 ECDH public key — null for FCM tokens */
        keyP256dh: varchar("key_p256dh"),
        /** Authentication secret — null for FCM tokens */
        keyAuth: varchar("key_auth"),
        expireAt: timestamp("expire_at"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        index("wallet_push_tokens_idx").on(table.wallet),
        unique("unique_push_token").on(
            table.wallet,
            table.type,
            table.endpoint
        ),
    ]
);
