import { createFileRoute } from "@tanstack/react-router";
import { AddEmail } from "@/module/settings/component/AddEmail";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/add-email"
)({
    component: AddEmailRoute,
});

function AddEmailRoute() {
    return <AddEmail />;
}
