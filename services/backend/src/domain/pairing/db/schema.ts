import {
    index,
    json,
    jsonb,
    pgTable,
    serial,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import type { IdentityNode } from "../../../orchestration/identity/types";
import { customHex } from "../../../utils/drizzle/customTypes";

export const pairingTable = pgTable(
    "device_pairing",
    {
        id: serial("id").primaryKey(),
        pairingId: varchar("pairing_id").notNull(), // Public ID for the pairing
        wallet: customHex("wallet"), // Null until target resolves pairing
        // Credential the target used to resolve this pairing. Captured at
        // join so resume can replay the exact `authenticated` payload (id +
        // pubkey + transports) without a wallet -> binding lookup. Null
        // until the pairing is resolved; null for legacy rows created
        // before this column existed (those resumes fall through to the
        // "no authenticator" close branch — pairings TTL out within minutes
        // so the legacy window is bounded).
        authenticatorId: varchar("authenticator_id"),

        // Credentials the joiner is allowed to resolve this pairing with.
        // Used by the cross-device wallet merge: the origin initiating a
        // merge pins every credential currently bound to the wallet it
        // intends to merge with; `handleJoin` rejects any mobile joining
        // with a credential outside this list. Null/empty means no
        // enforcement (regular pairings — login, SSO, listener).
        //
        // List rather than single hint so a wallet that holds multiple
        // passkeys (post-merge wallets accumulate them) can be reached
        // from any of those credentials. The peer authenticates with
        // whichever cred its OS surfaces; the join check is a set
        // membership rather than equality.
        authenticatorHints: varchar("authenticator_hints").array(),

        // Origin device info
        originUserAgent: varchar("origin_user_agent").notNull(),
        originName: varchar("origin_name").notNull(), // "Chrome on Windows", etc.

        // Identity context from origin device (SDK)
        // Used for identity resolution when pairing completes
        originNode: jsonb("origin_node").$type<IdentityNode>(),

        // Target device info
        targetUserAgent: varchar("target_user_agent"), // Null until paired
        targetName: varchar("target_name"), // Null until paired

        // Status and security
        pairingCode: varchar("pairing_code").notNull(), // For initial pairing
        createdAt: timestamp("created_at").notNull().defaultNow(),
        resolvedAt: timestamp("resolved_at"), // When target joins
        lastActiveAt: timestamp("last_active_at").notNull().defaultNow(), // For auto cleanup
    },
    (table) => [
        uniqueIndex("pairing_id_idx").on(table.pairingId),
        index("wallet_id_idx").on(table.wallet),
        uniqueIndex("pairing_code_idx").on(table.pairingCode),
    ]
);

export const pairingSignatureRequestTable = pgTable(
    "pairing_signature_request",
    {
        id: serial("id").primaryKey(),
        requestId: varchar("request_id").notNull(), // Unique request identifier
        pairingId: varchar("pairing_id").notNull(), // Associated pairing

        // Request details
        request: customHex("request").notNull(), // b64 serialized WebAuthn options
        context: json("context"), // Origin, operation type, description

        createdAt: timestamp("created_at").defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
        processedAt: timestamp("processed_at"),

        kind: varchar("kind").$type<"onchain" | "raw-assertion">(),

        signature: customHex("signature"),
    },
    (table) => [
        index("request_id_idx").on(table.requestId),
        index("signature_pairing_id_idx").on(table.pairingId),
    ]
);
