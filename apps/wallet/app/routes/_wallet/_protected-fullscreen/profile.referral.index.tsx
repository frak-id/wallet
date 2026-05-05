import { createFileRoute } from "@tanstack/react-router";
import { ReferralPage } from "@/module/referral/component/ReferralPage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral/"
)({
    component: ReferralPage,
});
