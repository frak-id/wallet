import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);

    // Embedded/admin entry always carries `shop` (managed install, App Bridge
    // loads, etc.) — hand those straight to the embedded app at /app.
    if (url.searchParams.has("shop")) {
        throw redirect(`/app?${url.searchParams.toString()}`);
    }

    // Otherwise this is a plain visit to the bare domain: send the merchant to
    // the login landing (shop-domain form) which kicks off the install flow.
    throw redirect("/auth/login");
};

export default function App() {
    return null;
}
