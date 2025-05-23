import { Elysia, t } from "elysia";
import { log } from "../../common";
import { AirtableRequestBodyType, type TableType } from "./config";
import { AirtableService } from "./service";

export const airtable = new Elysia({ prefix: "/airtable" })
    .decorate("airtableService", new AirtableService())
    .post(
        "/",
        async ({ body, query, error, airtableService }) => {
            // Validate required parameters
            if (!query.table) {
                return error(
                    400,
                    "table query parameter is required (demo_request or simulation)"
                );
            }

            if (!["demo_request", "simulation"].includes(query.table)) {
                return error(
                    400,
                    "table must be either 'demo_request' or 'simulation'"
                );
            }

            const tableType = query.table as TableType;

            if (!body.email) {
                return error(400, "email is required in request body");
            }

            try {
                await airtableService.processRequest(tableType, body);

                return {
                    success: true,
                };
            } catch (err) {
                log.error({ err }, "Airtable operation failed:");

                const errorMessage =
                    err instanceof Error ? err.message : String(err);

                // Handle specific error cases
                if (errorMessage.includes("already exists")) {
                    return error(409, errorMessage);
                }

                return error(500, `Failed to process request: ${errorMessage}`);
            }
        },
        {
            body: AirtableRequestBodyType,
            query: t.Object({
                table: t.String(),
            }),
        }
    );
