import { createFileRoute } from "@tanstack/react-router";
import { SetupCode } from "@/module/internal/component/SetupCode";

export const Route = createFileRoute("/_restricted/internal/setup-code")({
    component: SetupCode,
});
