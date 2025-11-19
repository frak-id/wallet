import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/module/common/component/RouteError";
import { CreatePushNotificationConfirmation } from "@/module/members/component/CreatePushConfirmation";

export const Route = createFileRoute("/_restricted/push/confirm")({
    component: ConfirmPushNotificationPage,
    errorComponent: (props) => (
        <RouteError
            {...props}
            title="Failed to Confirm Push Notification"
            fallbackPath="/push/create"
            fallbackLabel="Back to Create"
        />
    ),
});

function ConfirmPushNotificationPage() {
    return <CreatePushNotificationConfirmation />;
}
