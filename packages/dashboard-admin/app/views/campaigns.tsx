import type { Route } from "./+types/campaigns";

export function meta(_: Route.MetaArgs) {
    return [
        { title: "Campaigns - Frak Dashboard Admin" },
        {
            name: "description",
            content: "Campaigns section of the Frak admin dashboard",
        },
    ];
}

export default function Campaigns() {
    return (
        <div className="p-4">
            <p>Campaigns listing will appear here</p>
        </div>
    );
}
