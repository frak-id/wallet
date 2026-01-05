import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const merchantsTable = pgTable("merchants", {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").unique(),
    name: text("name").notNull(),
    config: jsonb("config"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
