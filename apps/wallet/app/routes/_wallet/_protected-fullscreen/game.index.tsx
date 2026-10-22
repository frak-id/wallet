import { createFileRoute, redirect } from "@tanstack/react-router";
import { GamePage } from "@/module/game/component/GamePage";
import { frakGame } from "@/module/game/config";

export const Route = createFileRoute("/_wallet/_protected-fullscreen/game/")({
    beforeLoad: () => {
        if (!frakGame.enabled) throw redirect({ to: "/wallet" });
    },
    component: GamePage,
});
