import { createFileRoute } from "@tanstack/react-router";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { frakBankQueryOptions } from "@/module/internal/api";
import { FrakBank } from "@/module/internal/component/FrakBank";

export const Route = createFileRoute("/_restricted/internal/bank")({
    loader: () => queryClient.ensureQueryData(frakBankQueryOptions()),
    component: FrakBank,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="Frak bank" />
    ),
});
