import { bigint, boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Same as the one from @shopify/shopify-app-session-storage-drizzle but using a recent version of drizzle-orm
 */
export const sessionTable = pgTable("session" as string, {
    id: text("id").primaryKey(),
    shop: text("shop").notNull(),
    state: text("state").notNull(),
    isOnline: boolean("isOnline").default(false).notNull(),
    scope: text("scope"),
    expires: timestamp("expires", { mode: "date" }),
    accessToken: text("accessToken"),
    userId: bigint("userId", { mode: "number" }),
});

export type SessionTable = typeof sessionTable;
