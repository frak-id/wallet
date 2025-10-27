import type { NotificationModel } from "@frak-labs/wallet-shared";
import { dexieDb } from "@frak-labs/wallet-shared";
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
    const { data: notifications } = useQuery({
        queryKey: notificationKey.history.baseKey,
        queryFn: async () => {
            const notifications = await dexieDb.notification.toArray();
            // Sort them by timestamp
            return notifications.sort((a, b) => b.timestamp - a.timestamp);
        },
    });

    if (!notifications) return <Skeleton count={3} height={110} />;

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
