import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { log } from "../services.server/logger";
import { PurchaseError, startupPurchase } from "../services.server/purchase";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const amount = url.searchParams.get("amount") ?? "";
    const bank = url.searchParams.get("bank") ?? "";

    const context = await authenticate.admin(request);

    try {
        const result = await startupPurchase(context, { amount, bank });
        return data(result);
    } catch (error) {
        // Validation failures carry their own status, so the client can tell
        // them apart from a real 5xx.
        if (error instanceof PurchaseError) {
            log.warn({ err: error, status: error.status }, "purchase rejected");
            return data({ error: error.message }, { status: error.status });
        }
        log.error({ err: error }, "purchase failed");
        return data({ error: "Internal error" }, { status: 500 });
    }
}
