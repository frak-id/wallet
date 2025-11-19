import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/")({
    beforeLoad: async () => {
        const isAuthenticated = useAuthStore.getState().isAuthenticated();
        throw redirect({
            to: isAuthenticated ? "/dashboard" : "/login",
        });
    },
});
