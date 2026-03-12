import { Button } from "@frak-labs/ui/component/Button";
import { BellOff } from "lucide-react";
import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { useNotificationStatus } from "@/module/notification/hook/useNotificationSetupStatus";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";

export function RemoveAllNotification() {
    const { hasLocalCapability } = useNotificationStatus();
    const { unsubscribeFromPush, isPending } =
        useUnsubscribeFromPushNotification();

    if (!hasLocalCapability) {
        return null;
    }

    return (
        <Panel size={"none"} variant={"empty"}>
            <Button
                onClick={() => unsubscribeFromPush()}
                disabled={isPending}
                isLoading={isPending}
                width={"full"}
            >
                <Row>
                    <BellOff size={32} /> Unsubscribe from all notifications
                </Row>
            </Button>
        </Panel>
    );
}
