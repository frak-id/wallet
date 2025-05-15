import { Elysia } from "elysia";
import ky from "ky";

export const airtable = new Elysia({ prefix: "/airtable" }).post(
    "/",
    async ({ body, query, error }) => {
        if (!query.path) {
            return error(400, "path is required");
        }

        const url = `https://hooks.airtable.com/workflows/v1/genericWebhook/appsfnUHGcLzwO4Bv/${query.path}`;
        await ky.post(url, {
            json: body,
        });

        return "ok";
    }
);
