import { createFileRoute, redirect } from "@tanstack/react-router";
import { LeaderboardPage } from "@/module/game/component/LeaderboardPage";
import { frakGame } from "@/module/game/config";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/leaderboard"
)({
    beforeLoad: () => {
        if (!frakGame.enabled) throw redirect({ to: "/profile" });
    },
    component: LeaderboardPage,
});
