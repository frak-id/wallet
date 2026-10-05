import type { LoaderFunctionArgs } from "react-router";
import AMBASSADOR_LIQUID from "../../proxy/ambassador.liquid?raw";
import { authenticate } from "../shopify.server";

/**
 * App proxy origin of the ambassador page on every stage but production,
 * which points the proxy at sdk.frak.id. A bad signature throws a 400.
 */
export async function loader({ request }: LoaderFunctionArgs) {
    const { liquid } = await authenticate.public.appProxy(request);
    return liquid(AMBASSADOR_LIQUID);
}
