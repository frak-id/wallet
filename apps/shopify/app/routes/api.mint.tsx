import type { LoaderFunctionArgs } from "react-router";
import { data } from "react-router";
import { getProductSetupCode } from "../services.server/mint";
import { authenticate } from "../shopify.server";
import { validateMintParams } from "../utils/url";

export async function loader({ request }: LoaderFunctionArgs) {
    const url = new URL(request.url);

    // Validate the wallet address from the request
    const mintResult = validateMintParams(
        url.searchParams.get("walletAddress")
    );
    if (!mintResult.valid) {
        return data(mintResult.error, { status: 400 });
    }

    // Authenticate the request
    const context = await authenticate.admin(request);

    try {
        // Delegate the core logic (including auth) to the service function
        const result = await getProductSetupCode(context, mintResult.address);
        return data(result);
    } catch (error) {
        console.error(`API Route Error (/api/wallet-data): ${error}`);
        return data("Error", { status: 500 });
    }
}
