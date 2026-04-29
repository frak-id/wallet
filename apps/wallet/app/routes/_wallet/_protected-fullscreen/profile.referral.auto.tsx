import { createFileRoute } from "@tanstack/react-router";
import { AutoGenerateReferralCodePage } from "@/module/referral/component/AutoGenerateReferralCodePage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral/auto"
)({
    component: AutoGenerateReferralCodePage,
});
