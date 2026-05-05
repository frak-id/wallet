import { createFileRoute } from "@tanstack/react-router";
import { CreateReferralCodePage } from "@/module/referral/component/CreateReferralCodePage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral/create"
)({
    component: CreateReferralCodePage,
});
