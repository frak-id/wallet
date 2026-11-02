import { createFileRoute } from "@tanstack/react-router";
import { InstagramLinkPage } from "@/module/instagram/component/InstagramLinkPage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/instagram"
)({
    component: InstagramLinkPage,
});
