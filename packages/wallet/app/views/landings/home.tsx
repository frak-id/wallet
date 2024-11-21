import { type LoaderFunction, redirect } from "@remix-run/node";

export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);

    if (url.pathname === "/") {
        return redirect("/wallet");
    }

    return null;
};

export default function Home() {
    return null;
}
