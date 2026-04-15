import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/module/settings/component/ProfilePage";

export const Route = createFileRoute("/_wallet/_protected/profile/")({
    component: ProfileRoute,
});

function ProfileRoute() {
    return <ProfilePage />;
}
