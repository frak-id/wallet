import { createFileRoute, redirect } from "@tanstack/react-router";
import { InstagramLinkPage } from "@/module/instagram/component/InstagramLinkPage";
import { instagramLink } from "@/module/instagram/config";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/instagram"
)({
    beforeLoad: () => {
        if (!instagramLink.enabled) throw redirect({ to: "/profile" });
    },
    component: InstagramLinkPage,
});
