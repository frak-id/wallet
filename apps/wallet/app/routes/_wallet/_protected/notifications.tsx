import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { notificationKey } from "@/module/notification/queryKeys/notification";
import type { NotificationModel } from "@/module/notification/storage/NotificationModel";
import { notificationStorage } from "@/module/notification/storage/notifications";

export const Route = createFileRoute("/_wallet/_protected/notifications")({
    component: NotificationsPage,
});

function NotificationsPage() {
    const { t } = useTranslation();
    const { data: notifications } = useQuery({
        queryKey: notificationKey.history.baseKey,
        queryFn: async () => {
            // Notifications are already sorted by timestamp in storage
            // Error handling is done in the storage layer
            return await notificationStorage.getAll();
        },
        // Default value, so the page never renders a loading state
        initialData: [],
    });

    if (notifications.length === 0) {
        return (
            <div>
                <Panel size={"small"}>
                    <Title icon={<BellRing />}>
                        {t("wallet.notifications.noNotifications")}
                    </Title>
                </Panel>
            </div>
        );
    }

    return (
        <div>
            {notifications.map((notificationItem, index) => (
                <Notification
                    key={`${notificationItem.timestamp}-${notificationItem.id}-${index}`}
                    notification={notificationItem}
                />
            ))}
        </div>
    );
}

/**
 * Component to display a single notification
 */
function Notification({ notification }: { notification: NotificationModel }) {
    return (
        <Panel size={"small"}>
            <Title icon={<BellRing />}>{notification.title}</Title>
            <Row withIcon={true}>{notification.body}</Row>
            <Row withIcon={true}>
                Date: {new Date(notification.timestamp).toLocaleString()}
            </Row>
        </Panel>
    );
}
