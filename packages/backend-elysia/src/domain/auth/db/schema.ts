import {
    index,
    pgTable,
    serial,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { customHex } from "../../../utils/drizzle/customTypes";

/**
 * Table storing the sso sessions
 */
export const ssoTable = pgTable(
    "sso_session",
    {
        id: serial("id").primaryKey(),
        ssoId: customHex("sso_id").notNull(),
        productId: customHex("product_id").notNull(),
        consumeKey: customHex("consume_key").notNull(),
        createdAt: timestamp("created_at").defaultNow(),
        resolvedAt: timestamp("resolved_at"),
        // Resolved wallet + authenticator id
        wallet: customHex("wallet"),
        authenticatorId: varchar("authenticator_id"),
    },
    (table) => [
        index("sso_idx").on(table.ssoId),
        uniqueIndex("sso_product_idx").on(table.ssoId, table.productId),
    ]
);
