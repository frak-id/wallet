import { t } from "@backend-utils";

export type TableType = "demo_request" | "simulation";

export const AirtableRequestBodyType = t.Union([
    t.Object({
        lastName: t.String(),
        firstName: t.String(),
        company: t.String(),
        phone: t.String(),
        email: t.String(),
        url: t.Optional(t.String()),
        position: t.String(),
        country: t.String(),
    }),
    t.Object({
        lastName: t.String(),
        firstName: t.String(),
        company: t.String(),
        phone: t.String(),
        email: t.String(),
        url: t.Optional(t.String()),
        visits: t.Number(),
        channels: t.Array(t.String()),
    }),
]);

export type AirtableRequestBody = typeof AirtableRequestBodyType.static;

export interface AirtableTableConfig {
    tableId: string;
    baseId: string;
}

export const AIRTABLE_CONFIG: Record<TableType, AirtableTableConfig> = {
    demo_request: {
        tableId:
            process.env.AIRTABLE_DEMO_REQUEST_TABLE_ID || "tbllje7E1oWyDjzhp",
        baseId: "appsfnUHGcLzwO4Bv",
    },
    simulation: {
        tableId:
            process.env.AIRTABLE_SIMULATION_TABLE_ID || "tblrcB9mxuJf6sinh",
        baseId: "appsfnUHGcLzwO4Bv",
    },
} as const;
