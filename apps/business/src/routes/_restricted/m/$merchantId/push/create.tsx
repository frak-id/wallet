import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { RouteError } from "@/module/common/component/RouteError";
import { CreatePushNotification } from "@/module/members/component/CreatePush";

export const Route = createFileRoute("/_restricted/m/$merchantId/push/create")({
    component: SendPushNotificationPage,
    errorComponent: CreatePushNotificationError,
});

function CreatePushNotificationError(props: ErrorComponentProps) {
    const { merchantId } = Route.useParams();
    return (
        <RouteError
            {...props}
            title="Failed to Create Push Notification"
            fallbackPath={`/m/${merchantId}/members`}
            fallbackLabel="Back to Members"
        />
    );
}

function SendPushNotificationPage() {
    return <CreatePushNotification />;
}
