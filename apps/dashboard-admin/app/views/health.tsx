import { isRunningInProd } from "@frak-labs/app-essentials";
import { IndexerState } from "../module/health/component/IndexerState";
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

const urls = isRunningInProd
    ? [
          "https://ponder.gcp.frak.id/status",
          "https://erpc.gcp.frak.id/",
          "https://backend.frak.id/health",
          "https://backend.gcp.frak.id/health",
      ]
    : [
          "https://ponder.gcp-dev.frak.id/status",
          "https://erpc.gcp-dev.frak.id/",
          "https://backend.gcp-dev.frak.id/health",
          "https://backend-dev.frak.id/health",
      ];

export default function Health() {
    return (
        <>
            <MeasurePings urls={urls} />

            <IndexerState />
        </>
    );
}
