import { createFileRoute } from "@tanstack/react-router";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import { frakCodesQueryOptions } from "@/module/internal/api";
import { ReferralCodes } from "@/module/internal/component/ReferralCodes";

export const Route = createFileRoute("/_restricted/internal/codes")({
    loader: () => queryClient.ensureQueryData(frakCodesQueryOptions()),
    component: ReferralCodes,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="referral codes" />
    ),
});
