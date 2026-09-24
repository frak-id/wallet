import { createFileRoute } from "@tanstack/react-router";
import { parseReferralCode } from "@/module/common/utils/parseReferralCode";
import { RedeemReferralCodePage } from "@/module/referral/component/RedeemReferralCodePage";

type RedeemSearch = {
    /** Pre-fills the field from a `?ref=` deep-link or login handoff. */
    code?: string;
};

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral/redeem"
)({
    component: RouteComponent,
    validateSearch: (search: Record<string, unknown>): RedeemSearch => ({
        code: parseReferralCode(search.code),
    }),
});

function RouteComponent() {
    const { code } = Route.useSearch();
    return <RedeemReferralCodePage initialCode={code} />;
}
