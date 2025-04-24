import { MeasurePings } from "../module/health/component/Ping";
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

            <MeasurePings
                urls={[
                    "https://ponder.gcp.frak.id/status",
                    "https://ponder.gcp-dev.frak.id/status",
                    "https://erpc.gcp.frak.id/",
                    "https://erpc.gcp-dev.frak.id/",
                    "https://backend.gcp.frak.id/health",
                    "https://backend.gcp-dev.frak.id/health",
                    "https://backend.frak.id/health",
                    "https://backend-dev.frak.id/health",
                ]}
            />
        </div>
    );
}
