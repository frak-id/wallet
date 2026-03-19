import {
    index,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";
import type { SendNotificationPayload } from "../dto/SendNotificationDto";

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

export type NotificationType =
    | "promotional"
    | "reward_pending"
    | "reward_settled";

export type NotificationStatus = "sent" | "opened";

/**
 * Groups individual notification_sent rows for a single merchant broadcast.
 * Each time a merchant clicks "Send" in the dashboard, one row is created here.
 */
export const notificationBroadcastsTable = pgTable(
    "notification_broadcasts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        merchantId: uuid("merchant_id").notNull(),
        payload: jsonb("payload").$type<SendNotificationPayload>().notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("notification_broadcasts_merchant_idx").on(table.merchantId),
        index("notification_broadcasts_created_at_idx").on(table.createdAt),
    ]
);

export type NotificationBroadcastInsert =
    typeof notificationBroadcastsTable.$inferInsert;
export type NotificationBroadcastSelect =
    typeof notificationBroadcastsTable.$inferSelect;

/**
 * One row per notification actually sent to a wallet.
 * Wallet history page reads all types; merchant broadcast stats join via broadcastId.
 */
export const notificationSentTable = pgTable(
    "notification_sent",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        wallet: customHex("wallet").notNull().$type<Address>(),
        type: text("type").$type<NotificationType>().notNull(),
        title: text("title").notNull(),
        body: text("body").notNull(),
        payload: jsonb("payload").$type<SendNotificationPayload>().notNull(),
        broadcastId: uuid("broadcast_id"),
        sentAt: timestamp("sent_at").defaultNow().notNull(),
        openedAt: timestamp("opened_at"),
    },
    (table) => [
        index("notification_sent_wallet_idx").on(table.wallet),
        index("notification_sent_type_idx").on(table.type),
        index("notification_sent_broadcast_idx").on(table.broadcastId),
        index("notification_sent_sent_at_idx").on(table.sentAt),
        index("notification_sent_wallet_sent_at_idx").on(
            table.wallet,
            table.sentAt
        ),
    ]
);

export type NotificationSentInsert = typeof notificationSentTable.$inferInsert;
export type NotificationSentSelect = typeof notificationSentTable.$inferSelect;
export type NotificationSentWithStatus = NotificationSentSelect & {
    status: NotificationStatus;
};
