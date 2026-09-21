import { createFileRoute } from "@tanstack/react-router";
import { RewardCodePage } from "@/module/reward-code/component/RewardCodePage";

export const Route = createFileRoute("/_wallet/_auth/reward-code")({
    component: RewardCodePage,
});
