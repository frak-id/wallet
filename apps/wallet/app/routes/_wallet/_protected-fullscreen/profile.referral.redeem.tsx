import { createFileRoute } from "@tanstack/react-router";
import { RedeemReferralCodePage } from "@/module/referral/component/RedeemReferralCodePage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral/redeem"
)({
    component: RedeemReferralCodePage,
});
