import type { NotificationModel } from "@/context/common/dexie/NotificationModel";
import { dexieDb } from "@/context/common/dexie/dexieDb";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Title } from "@/module/common/component/Title";
import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";

export function NotificationHistory() {
    const { data: notifications } = useQuery({
        queryKey: ["notification", "history"],
        queryFn: async () => {
            const notifications = await dexieDb.notification.toArray();
            // Sort them by timestamp
            return notifications.sort((a, b) => b.timestamp - a.timestamp);
        },
    });

    if (!notifications) return <Skeleton count={3} height={110} />;

    return notifications?.map((notificationItem) => (
        <Notification
            key={notificationItem.id}
            notification={notificationItem}
        />
    ));
}

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
