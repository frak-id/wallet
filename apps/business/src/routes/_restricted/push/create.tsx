import { createFileRoute } from "@tanstack/react-router";
import { CreatePushNotification } from "@/module/members/component/CreatePush";

export const Route = createFileRoute("/_restricted/push/create")({
    component: SendPushNotificationPage,
});

function SendPushNotificationPage() {
    return <CreatePushNotification />;
}
