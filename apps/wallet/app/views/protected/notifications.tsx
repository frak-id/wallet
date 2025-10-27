import type { NotificationModel } from "@frak-labs/wallet-shared";
import { notificationStorage } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { notificationKey } from "@/module/notification/queryKeys/notification";

/**
 * View to display user notifications history
 */
export default function Notifications() {
    const { t } = useTranslation();
    const { data: notifications, isLoading } = useQuery({
        queryKey: notificationKey.history.baseKey,
        queryFn: async () => {
            // Notifications are already sorted by timestamp in storage
            // Error handling is done in the storage layer
            return await notificationStorage.getAll();
        },
        // Add default value to prevent loading state on first render
        initialData: [],
    });

    if (isLoading) {
        return (
            <Grid>
                <Skeleton count={3} height={110} />
            </Grid>
        );
    }

    if (notifications.length === 0) {
        return (
            <Grid>
                <Panel size={"small"}>
                    <Title icon={<BellRing />}>
                        {t("wallet.notifications.noNotifications")}
                    </Title>
                </Panel>
            </Grid>
        );
    }

    return (
        <Grid>
            {notifications?.map((notificationItem, index) => (
                <Notification
                    key={`${notificationItem.timestamp}-${notificationItem.id}-${index}`}
                    notification={notificationItem}
                />
            ))}
        </Grid>
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
