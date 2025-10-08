import { Elysia, status, t } from "elysia";
import { log } from "../../common";
import { AirtableRequestBodyType, type TableType } from "../../domain/airtable";
import { AirtableRepository } from "../../domain/airtable";

/**
 * Airtable API routes for external integrations
 * Used by landing pages and other external services
 */
export const airtableRoutes = new Elysia({ name: "Routes.airtable" })
    .decorate("airtableRepository", new AirtableRepository())
    .post(
        "/airtable",
        async ({ body, query, airtableRepository }) => {
            // Validate required parameters
            if (!query.table) {
                return status(
                    400,
                    "table query parameter is required (demo_request or simulation)"
                );
            }

            if (!["demo_request", "simulation"].includes(query.table)) {
                return status(
                    400,
                    "table must be either 'demo_request' or 'simulation'"
                );
            }

            const tableType = query.table as TableType;

            if (!body.email) {
                return status(400, "email is required in request body");
            }

            try {
                await airtableRepository.processRequest(tableType, body);

                return {
                    success: true,
                };
            } catch (err) {
                log.error({ err }, "Airtable operation failed:");

                const errorMessage =
                    err instanceof Error ? err.message : String(err);

                // Handle specific error cases
                if (errorMessage.includes("already exists")) {
                    return status(409, errorMessage);
                }

                return status(
                    500,
                    `Failed to process request: ${errorMessage}`
                );
            }
        },
        {
            body: AirtableRequestBodyType,
            query: t.Object({
                table: t.String(),
            }),
            response: {
                200: t.Object({
                    success: t.Boolean(),
                }),
                400: t.String(),
                409: t.String(),
                500: t.String(),
            },
        }
    );
