import { isRunningInProd } from "@frak-labs/app-essentials";
import { createFileRoute } from "@tanstack/react-router";
import { IndexerState } from "~/module/health/component/IndexerState";
import { MeasurePings } from "~/module/health/component/Ping";

export const Route = createFileRoute("/_layout/health")({
    component: HealthComponent,
});

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

function HealthComponent() {
    return (
        <>
            <MeasurePings urls={urls} />
            <IndexerState />
        </>
    );
}
