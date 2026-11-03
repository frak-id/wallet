import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_restricted/internal/")({
    beforeLoad: () => {
        throw redirect({ to: "/internal/game", replace: true });
    },
});
