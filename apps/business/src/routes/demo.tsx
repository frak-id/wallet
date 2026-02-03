import { isRunningInProd } from "@frak-labs/app-essentials";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

export const Route = createFileRoute("/demo")({
    beforeLoad: () => {
        // Only allow in development and staging (block production)
        if (isRunningInProd) {
            throw new Error("Demo mode not available in production");
        }

        const store = useAuthStore.getState();
        if (store.token !== "demo-token") {
            store.setAuth(
                "demo-token",
                "0x0000000000000000000000000000000000000001" as Address,
                Date.now() + 7 * 24 * 60 * 60 * 1000
            );
        }

        throw redirect({ to: "/dashboard" });
    },
});
