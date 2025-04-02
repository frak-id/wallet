import {
    index,
    json,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { customHex } from "../../../utils/drizzle/customTypes";

export const pairingTable = pgTable(
    "device_pairing",
    {
        id: serial("id").primaryKey(),
        pairingId: customHex("pairing_id").notNull(), // Public ID for the pairing
        wallet: customHex("wallet"), // Null until target resolves pairing

        // Origin device info
        originUserAgent: varchar("origin_user_agent").notNull(),
        originName: varchar("origin_name").notNull(), // "Chrome on Windows", etc.

        // Target device info
        targetUserAgent: varchar("target_user_agent"), // Null until paired
        targetName: varchar("target_name"), // Null until paired

        // Status and security
        pairingCode: varchar("pairing_code").notNull(), // For initial pairing
        createdAt: timestamp("created_at").defaultNow(),
        resolvedAt: timestamp("resolved_at"), // When target joins
        lastActiveAt: timestamp("last_active_at").defaultNow(), // For auto cleanup
    },
    (table) => [
        uniqueIndex("pairing_id_idx").on(table.pairingId),
        index("wallet_id_idx").on(table.walletId),
        uniqueIndex("pairing_code_idx").on(table.pairingCode),
    ]
);

export const webAuthnRequestTable = pgTable(
    "webauthn_request",
    {
        id: serial("id").primaryKey(),
        requestId: customHex("request_id").notNull(), // Unique request identifier
        pairingId: customHex("pairing_id").notNull(), // Associated pairing

        // Request details
        webAuthnOptions: text("webauthn_options").notNull(), // b64 serialized WebAuthn options
        context: json("context").notNull(), // Origin, operation type, description

        // Status tracking
        createdAt: timestamp("created_at").defaultNow(),
        processedAt: timestamp("processed_at"), // When target processed request

        // Result (null until processed)
        response: text("webauthn_response"), // WebAuthn credential response
    },
    (table) => [
        index("request_id_idx").on(table.requestId),
        index("pairing_id_idx").on(table.pairingId),
    ]
);
