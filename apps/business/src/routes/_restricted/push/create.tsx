import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/module/common/component/RouteError";
import { CreatePushNotification } from "@/module/members/component/CreatePush";

export const Route = createFileRoute("/_restricted/push/create")({
    component: SendPushNotificationPage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Create Push Notification"
            fallbackPath="/members"
            fallbackLabel="Back to Members"
        />
    ),
});

function SendPushNotificationPage() {
    return <CreatePushNotification />;
}
