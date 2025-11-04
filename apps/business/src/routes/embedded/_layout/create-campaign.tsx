import { createFileRoute } from "@tanstack/react-router";
import { AuthenticationGated } from "@/module/embedded/component/AuthenticationGated";
import { EmbeddedCreateCampaign } from "@/module/embedded/component/CreateCampaign";

export const Route = createFileRoute("/embedded/_layout/create-campaign")({
    component: EmbeddedCreateCampaignPage,
    validateSearch: (search: Record<string, unknown>) => {
        // Required parameters
        const n = search.n as string | undefined;
        const bid = search.bid as string | undefined;
        const d = search.d as string | undefined;
        const cac = search.cac as string | undefined;
        const r = search.r as string | undefined;

        // Optional parameters
        const sc = search.sc as string | undefined;
        const wb = search.wb as string | undefined;
        const mb = search.mb as string | undefined;
        const gb = search.gb as string | undefined;

        return {
            n: n ?? "",
            bid: bid ?? "",
            d: d ?? "",
            cac: cac ?? "",
            r: r ?? "",
            sc,
            wb,
            mb,
            gb,
        };
    },
});

function EmbeddedCreateCampaignPage() {
    return (
        <AuthenticationGated action="validate your product">
            <EmbeddedCreateCampaign />
        </AuthenticationGated>
    );
}
