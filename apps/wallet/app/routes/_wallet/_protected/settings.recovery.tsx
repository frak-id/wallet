import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_wallet/_protected/settings/recovery")({
    beforeLoad: () => {
        throw redirect({ to: "/profile/recovery", replace: true });
    },
});
