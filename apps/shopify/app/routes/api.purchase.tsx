import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { log } from "../services.server/logger";
import { PurchaseError, startupPurchase } from "../services.server/purchase";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);
    const amount = url.searchParams.get("amount") ?? "";
    const bank = url.searchParams.get("bank") ?? "";

    // Authenticate the request
    const context = await authenticate.admin(request);

    try {
        // Delegate the core logic (including auth) to the service function
        const result = await startupPurchase(context, { amount, bank });
        return data(result);
    } catch (error) {
        // Validation / client-shaped failures carry their own status + a
        // meaningful message; surface both so the client can tell them apart
        // from a real 5xx instead of an opaque bare "Error".
        if (error instanceof PurchaseError) {
            log.warn({ err: error, status: error.status }, "purchase rejected");
            return data({ error: error.message }, { status: error.status });
        }
        log.error({ err: error }, "purchase failed");
        return data({ error: "Internal error" }, { status: 500 });
    }
}
