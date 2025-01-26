import { customHex } from "@backend-utils";
import {
    pgTable,
    serial,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";

/**
 * Table storing the domain where 6degrees routing are automatic
 */
export const fixedRoutingTable = pgTable(
    "6degrees_fixed_routing",
    {
        id: serial("id").primaryKey(),
        domain: varchar("domain").notNull(),
        campaignId: varchar("campaign_id").notNull(),
    },
    (table) => [uniqueIndex("6degrees_routing_domain").on(table.domain)]
);

/**
 * Table storing all the webauthn public key that are redirected to 6degrees
 */
export const walletRoutingTable = pgTable(
    "6degrees_wallet_routing",
    {
        id: serial("id").primaryKey(),
        walletPubKey: customHex("wallet_pub_key").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [uniqueIndex("6degrees_routing_wallet").on(table.walletPubKey)]
);
