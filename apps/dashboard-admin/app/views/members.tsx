import type { Route } from "./+types/members";

export function meta(_: Route.MetaArgs) {
    return [
        { title: "Members - Frak Dashboard Admin" },
        {
            name: "description",
            content: "Members section of the Frak admin dashboard",
        },
    ];
}

export default function Members() {
    return (
        <div className="p-4">
            <p>Members listing will appear here</p>
        </div>
    );
}
