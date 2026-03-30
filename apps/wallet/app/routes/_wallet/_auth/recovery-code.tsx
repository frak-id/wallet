import { createFileRoute } from "@tanstack/react-router";
import { RecoveryCodePage } from "@/module/recovery-code/component/RecoveryCodePage";

export const Route = createFileRoute("/_wallet/_auth/recovery-code")({
    component: RecoveryCodePage,
});
