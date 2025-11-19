import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/middleware/auth";

export const Route = createFileRoute("/")({
    beforeLoad: async () => {
        throw redirect({
            to: isAuthenticated() ? "/dashboard" : "/login",
        });
    },
});
