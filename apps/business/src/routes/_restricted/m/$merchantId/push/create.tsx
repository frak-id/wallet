import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { RouteError } from "@/module/common/component/RouteError";
import { CreatePushNotification } from "@/module/members/component/CreatePush";

export const Route = createFileRoute("/_restricted/m/$merchantId/push/create")({
    staticData: { shell: "bare" },
    component: SendPushNotificationPage,
    errorComponent: CreatePushNotificationError,
});

function CreatePushNotificationError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    const { merchantId } = Route.useParams();
    return (
        <RouteError
            {...props}
            title={t("errors.pushCreate.title")}
            fallbackPath={`/m/${merchantId}/members`}
            fallbackLabel={t("errors.pushCreate.back")}
        />
    );
}

function SendPushNotificationPage() {
    return <CreatePushNotification />;
}
