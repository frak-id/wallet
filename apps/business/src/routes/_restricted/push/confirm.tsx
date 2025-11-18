import { createFileRoute } from "@tanstack/react-router";
import { CreatePushNotificationConfirmation } from "@/module/members/component/CreatePushConfirmation";

export const Route = createFileRoute("/_restricted/push/confirm")({
    component: ConfirmPushNotificationPage,
});

function ConfirmPushNotificationPage() {
    return <CreatePushNotificationConfirmation />;
}
