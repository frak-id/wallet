import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { startupPurchase } from "../services.server/purchase";
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
        console.error(`API Route Error (/api/wallet-data): ${error}`);
        return data("Error", { status: 500 });
    }
}
