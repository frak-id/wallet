import type { Route } from "./+types/health";

export function meta(_: Route.MetaArgs) {
    return [
        { title: "Health - Frak Dashboard Admin" },
        {
            name: "description",
            content: "Health status of Frak services",
        },
    ];
}

export default function Health() {
    return (
        <div className="p-4">
            <p>Service health status will appear here</p>
        </div>
    );
}
