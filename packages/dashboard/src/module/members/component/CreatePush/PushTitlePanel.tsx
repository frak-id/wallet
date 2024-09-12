"use client";

import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/index";
import { Input } from "@module/component/forms/Input";
import { useFormContext } from "react-hook-form";

/**
 * Audience panel
 * @constructor
 */
export function PushTitlePanel() {
    const form = useFormContext<FormCreatePushNotification>();
    return (
        <Panel title={"Push Notification Title"}>
            <FormField
                control={form.control}
                name={"pushCampaignTitle"}
                rules={{
                    required: "Push campaign title is required",
                    minLength: 5,
                    maxLength: 100,
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>
                            Enter the title of your push campaign
                        </FormLabel>
                        <FormControl>
                            <Input
                                length={"medium"}
                                placeholder={"My New Push Campaign"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </Panel>
    );
}
