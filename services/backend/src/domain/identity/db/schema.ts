import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { customHex } from "../../../utils/drizzle/customTypes";

export const identityGroupsTable = pgTable(
    "identity_groups",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        walletAddress: customHex("wallet_address").$type<Address>().unique(),
        createdAt: timestamp("created_at").defaultNow(),
        updatedAt: timestamp("updated_at").defaultNow(),
    },
    (table) => [index("identity_groups_wallet_idx").on(table.walletAddress)]
);

export const identityTypeEnum = pgEnum("identity_type", [
    "anonymous_fingerprint",
    "merchant_customer",
    "wallet",
]);

export const identityNodesTable = pgTable(
    "identity_nodes",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        groupId: uuid("group_id")
            .references(() => identityGroupsTable.id, { onDelete: "cascade" })
            .notNull(),
        identityType: identityTypeEnum("identity_type").notNull(),
        identityValue: text("identity_value").notNull(),
        merchantId: uuid("merchant_id"),
        createdAt: timestamp("created_at").defaultNow(),
    },
    (table) => [
        unique("identity_nodes_unique_identity").on(
            table.identityType,
            table.identityValue,
            table.merchantId
        ),
        index("identity_nodes_group_idx").on(table.groupId),
        index("identity_nodes_type_value_idx").on(
            table.identityType,
            table.identityValue
        ),
    ]
);
