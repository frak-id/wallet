import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { RouteError } from "@/module/common/component/RouteError";
import { CreatePushNotificationConfirmation } from "@/module/members/component/CreatePushConfirmation";
import { pushCreationStore } from "@/stores/pushCreationStore";

export const Route = createFileRoute("/_restricted/m/$merchantId/push/confirm")(
    {
        /**
         * Guard against:
         * 1. Direct hits with no draft (refresh after publish, back
         *    button after success, deep links) → land back on composer.
         * 2. A draft started under a different merchant — switching
         *    merchants while composing must NOT publish the previous
         *    merchant's draft under the new one's id. We send the user
         *    to the composer (the resume guard there discards the stale
         *    draft) instead of silently rebinding it.
         */
        beforeLoad: ({ params }) => {
            const state = pushCreationStore.getState();
            const draft = state.currentPushCreationForm;
            const mismatch =
                draft && state.draftMerchantId !== params.merchantId;
            if (!draft || mismatch) {
                throw redirect({
                    to: "/m/$merchantId/push/create",
                    params: { merchantId: params.merchantId },
                    replace: true,
                });
            }
        },
        component: ConfirmPushNotificationPage,
        errorComponent: ConfirmPushNotificationError,
    }
);

function ConfirmPushNotificationError(props: ErrorComponentProps) {
    const { merchantId } = Route.useParams();
    return (
        <RouteError
            {...props}
            title="Failed to Confirm Push Notification"
            fallbackPath={`/m/${merchantId}/push/create`}
            fallbackLabel="Back to Create"
        />
    );
}

function ConfirmPushNotificationPage() {
    return <CreatePushNotificationConfirmation />;
}
