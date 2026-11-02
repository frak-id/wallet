import { createFileRoute } from "@tanstack/react-router";
import { GamePage } from "@/module/game/component/GamePage";

export const Route = createFileRoute("/_wallet/_protected-fullscreen/game/")({
    component: GamePage,
});
