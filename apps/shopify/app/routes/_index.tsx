import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const search = request.url.split("?")[1];
    throw redirect(`/app${search ? `?${search}` : ""}`);
};

export default function App() {
    return null;
}
