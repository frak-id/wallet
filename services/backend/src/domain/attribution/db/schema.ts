import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import type { Address } from "viem";
import { identityGroupsTable } from "../../identity/db/schema";

export const touchpointSourceEnum = pgEnum("touchpoint_source", [
    "referral_link",
    "organic",
    "paid_ad",
    "direct",
]);

export type TouchpointSourceData =
    | {
          type: "referral_link";
          referrerWallet: Address;
      }
    | {
          type: "organic";
      }
    | {
          type: "paid_ad";
          utmSource?: string;
          utmMedium?: string;
          utmCampaign?: string;
          utmTerm?: string;
          utmContent?: string;
      }
    | {
          type: "direct";
      };

export const touchpointsTable = pgTable(
    "touchpoints",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        identityGroupId: uuid("identity_group_id")
            .references(() => identityGroupsTable.id, { onDelete: "cascade" })
            .notNull(),
        merchantId: uuid("merchant_id").notNull(),
        source: touchpointSourceEnum("source").notNull(),
        sourceData: jsonb("source_data")
            .$type<TouchpointSourceData>()
            .notNull(),
        landingUrl: text("landing_url"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at"),
    },
    (table) => [
        index("touchpoints_identity_group_idx").on(table.identityGroupId),
        index("touchpoints_merchant_idx").on(table.merchantId),
        index("touchpoints_identity_merchant_idx").on(
            table.identityGroupId,
            table.merchantId
        ),
        index("touchpoints_expires_at_idx").on(table.expiresAt),
    ]
);
