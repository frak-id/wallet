import { createFileRoute } from "@tanstack/react-router";
import { ShareReferralCodePage } from "@/module/referral/component/ShareReferralCodePage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral/share"
)({
    component: ShareReferralCodePage,
});
