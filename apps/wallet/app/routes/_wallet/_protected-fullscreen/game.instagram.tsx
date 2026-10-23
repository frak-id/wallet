import { createFileRoute, redirect } from "@tanstack/react-router";
import { InstagramLinkPage } from "@/module/game/component/InstagramLinkPage";
import { frakGame } from "@/module/game/config";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/game/instagram"
)({
    beforeLoad: () => {
        if (!frakGame.enabled) throw redirect({ to: "/wallet" });
    },
    component: InstagramLinkPage,
});
