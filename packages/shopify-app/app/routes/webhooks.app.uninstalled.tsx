import type { ActionFunctionArgs } from "@remix-run/node";
import { eq } from "drizzle-orm";
import { sessionTable } from "../../db/schema/sessionTable";
import { drizzleDb } from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { shop, session, topic } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    // Webhook requests can trigger multiple times and after an app has already been uninstalled.
    // If this webhook already ran, the session may have been deleted previously.
    if (session) {
        await drizzleDb.delete(sessionTable).where(eq(sessionTable.shop, shop));
    }

    return new Response();
};
