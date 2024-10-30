import { Panel } from "@/module/common/component/Panel";
import { Row } from "@/module/common/component/Row";
import { useUnsubscribeFromPushNotification } from "@/module/notification/hook/useUnsubscribeFromPushNotification";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { BellOff } from "lucide-react";

export function RemoveAllNotification() {
    const { hasPushToken, unsubscribeFromPush, isPending } =
        useUnsubscribeFromPushNotification();

    // If the user don't have any push token, early exit
    if (!hasPushToken) {
        return null;
    }

    // Otherwise, button to unsubscribe from all the notification
    return (
        <Panel size={"none"} variant={"empty"}>
            <ButtonRipple
                size={"small"}
                onClick={unsubscribeFromPush}
                disabled={isPending}
                isLoading={isPending}
            >
                <Row>
                    <BellOff size={32} /> Unsubscribe from all notifications
                </Row>
            </ButtonRipple>
        </Panel>
    );
}
