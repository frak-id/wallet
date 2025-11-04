import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { CreatePushNotificationConfirmation } from "@/module/members/component/CreatePushConfirmation";

export const Route = createFileRoute("/push/confirm")({
    beforeLoad: requireAuth,
    component: ConfirmPushNotificationPage,
});

function ConfirmPushNotificationPage() {
    return (
        <RestrictedLayout>
            <CreatePushNotificationConfirmation />
        </RestrictedLayout>
    );
}
