import { sql } from "drizzle-orm";
import {
    bigserial,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

/**
 * Source of truth for the identity-node taxonomy. Defined here (next to the
 * column that consumes it) rather than in `../schemas/index.ts` so the
 * runtime Drizzle table can be imported from environments that don't pull
 * in the backend's TypeBox helpers (e.g. the bootstrap migration job).
 */
export type IdentityType = "anonymous_fingerprint" | "wallet" | "email";

export type PendingPurchaseValidation = {
    orderId: string;
    purchaseToken: string;
};

export type MergedGroup = {
    groupId: string;
    mergedAt: string;
};

export const identityGroupsTable = pgTable("identity_groups", {
    id: uuid("id").primaryKey().defaultRandom(),
    mergedGroups: jsonb("merged_groups").$type<MergedGroup[]>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

/**
 * Encrypted recovery backup, anchored on an identity group like email.
 *
 * `blob` is opaque ciphertext sealed client-side with the user's password: the
 * backend is a zero-knowledge store, it never receives the password nor decrypts.
 * One row per group (`group_id` unique); the API upserts — a recovery refresh
 * that mints a fresh burner replaces the blob and stamps `updated_at`.
 */
export const recoveryBlobsTable = pgTable("recovery_blobs", {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().unique(),
    blob: text("blob").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type RecoveryBlobSelect = typeof recoveryBlobsTable.$inferSelect;

export const identityNodesTable = pgTable(
    "identity_nodes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id").notNull(),
        identityType: text("identity_type").$type<IdentityType>().notNull(),
        identityValue: text("identity_value").notNull(),
        merchantId: uuid("merchant_id"),
        validationData:
            jsonb("validation_data").$type<PendingPurchaseValidation>(),
        createdAt: timestamp("created_at").defaultNow(),
        // Soft-unlink marker. Stamped on the loser wallet identity node
        // during a wallet merge so `getWalletForGroup` can deterministically
        // resolve to the winner while keeping the loser->group mapping
        // available for `findGroupByIdentity` (prevents stray references to
        // the loser wallet from accidentally creating a new identity group).
        unlinkedAt: timestamp("unlinked_at"),
        // Verification stamp for email nodes (`null` for unverified + every
        // non-email type). With `unlinked_at` it encodes the email lifecycle:
        // pending (both null) -> verified (set, null) -> legacy (unlinked set).
        verifiedAt: timestamp("verified_at"),
    },
    (table) => [
        unique("identity_nodes_unique_identity")
            .on(table.identityType, table.identityValue, table.merchantId)
            .nullsNotDistinct(),
        index("identity_nodes_group_idx").on(table.groupId),
    ]
);

/**
 * Reason values written on a wallet binding row.
 *  - `initial`   — first binding when a credential is registered.
 *  - `merged`    — written by the wallet-merge flow when the previous active
 *                  binding for `(authenticator, chain)` gets repointed to a
 *                  winner wallet.
 *  - `recovery`  — reserved for the recovery flow refactor (Phase 3+); never
 *                  written by Phase 1 code paths.
 */
export type BindingReason = "initial" | "merged" | "recovery";

/**
 * Mapping of WebAuthn credential → smart-account address, per chain,
 * per environment (postgres is schema-per-env).
 *
 *  - One ACTIVE row per `(authenticator_id, chain_id)` enforced by a partial
 *    unique index (`unlinked_at IS NULL`).
 *  - History is preserved on every mutation: the previous row gets stamped
 *    with `unlinked_at = now()` and a new row is inserted with the incoming
 *    binding. Useful audit trail for merges and recoveries.
 *  - `authenticator_id` is a text reference to the libSQL `authenticators`
 *    table's credential id. No FK across databases.
 *  - Lives in postgres (env-scoped) rather than libSQL (env-shared) so a
 *    merge performed on one environment can never leak the repointed binding
 *    into another environment that runs on the same chain.
 */
export const authenticatorWalletBindingsTable = pgTable(
    "authenticator_wallet_bindings",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        authenticatorId: text("authenticator_id").notNull(),
        chainId: integer("chain_id").notNull(),
        smartWalletAddress: customHex("smart_wallet_address")
            .$type<Address>()
            .notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        unlinkedAt: timestamp("unlinked_at"),
        reason: text("reason").$type<BindingReason>().notNull(),
    },
    (table) => [
        uniqueIndex("awb_active_idx")
            .on(table.authenticatorId, table.chainId)
            .where(sql`unlinked_at IS NULL`),
        index("awb_wallet_chain_idx")
            .on(table.smartWalletAddress, table.chainId)
            .where(sql`unlinked_at IS NULL`),
    ]
);

export type AuthenticatorWalletBindingSelect =
    typeof authenticatorWalletBindingsTable.$inferSelect;

export const installCodesTable = pgTable(
    "install_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        code: varchar("code", { length: 6 }).notNull(),
        merchantId: uuid("merchant_id").notNull(),
        anonymousId: text("anonymous_id").notNull(),
        // Optional device-pairing scope: the app resolving this code joins
        // this pairing, handing a distant-webauthn session to the web origin
        // (SSO pair-to-install). Null for plain referral-attribution codes.
        pairingId: varchar("pairing_id", { length: 64 }),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (table) => [
        uniqueIndex("install_codes_code_idx").on(table.code),
        index("install_codes_merchant_anonymous_idx").on(
            table.merchantId,
            table.anonymousId
        ),
        index("install_codes_expires_at_idx").on(table.expiresAt),
    ]
);

/**
 * Transient email-verification challenge, one active row per identity group
 * (`group_id` unique -> a resend upserts in place). `email` is the address
 * being proven: for a first verify it equals the group's current email, for a
 * rotation it is the pending address. `last_sent_at` drives the resend
 * debounce, `attempts` caps brute-force, `expires_at` bounds the TTL.
 */
export const emailVerificationCodesTable = pgTable(
    "email_verification_codes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id").notNull().unique(),
        email: text("email").notNull(),
        code: varchar("code", { length: 6 }).notNull(),
        attempts: integer("attempts").notNull().default(0),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
        expiresAt: timestamp("expires_at").notNull(),
        consumedAt: timestamp("consumed_at"),
    },
    (table) => [index("evc_expires_at_idx").on(table.expiresAt)]
);

export type EmailVerificationCodeSelect =
    typeof emailVerificationCodesTable.$inferSelect;
