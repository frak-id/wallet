"use client";

import { Head } from "@/module/common/component/Head";
import { CreatePushNotification } from "@/module/members/component/CreatePush";
import { Button } from "@module/component/Button";

export default function ValidatePushNotificationPage() {
    return (
        <>
            <Head
                title={{ content: "Push Notification Validation" }}
                rightSection={
                    <Button
                        variant={"outline"}
                        onClick={() => {
                            // todo: go back
                        }}
                    >
                        Cancel
                    </Button>
                }
            />
            <CreatePushNotification />
        </>
    );
}
