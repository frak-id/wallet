import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";
import { CreatePushNotification } from "@/module/members/component/CreatePush";

export const Route = createFileRoute("/push/create")({
    beforeLoad: requireAuth,
    component: SendPushNotificationPage,
});

function SendPushNotificationPage() {
    return (
        <RestrictedLayout>
            <CreatePushNotification />
        </RestrictedLayout>
    );
}
