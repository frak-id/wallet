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
import { TextArea } from "@module/component/forms/TextArea";
import { useFormContext } from "react-hook-form";

/**
 *  Build the push payload panel
 *    todo:
 *      - Preview of the push notification on the right side
 *      - Icon url for the push notification
 *      - TextArea for the message?
 * @constructor
 */
export function PushPayloadPanel() {
    const { control } = useFormContext<FormCreatePushNotification>();
    return (
        <Panel title={"Message"}>
            {/*Title field*/}
            <FormField
                control={control}
                name={"payload.title"}
                rules={{
                    required: "Push title required",
                    minLength: {
                        value: 8,
                        message:
                            "The notification title require at least 8 characters",
                    },
                    maxLength: {
                        value: 40,
                        message:
                            "The notification title can't exceed 40 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Title</FormLabel>
                        <FormControl>
                            <Input
                                length={"medium"}
                                placeholder={"Brand new shoes"}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {/*Message field*/}
            <FormField
                control={control}
                name={"payload.body"}
                rules={{
                    required: "Push message required",
                    minLength: {
                        value: 10,
                        message: "The message require at least 10 characters",
                    },
                    maxLength: {
                        value: 500,
                        message: "The message can't exceed 500 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Message</FormLabel>
                        <FormControl>
                            <TextArea
                                length={"medium"}
                                placeholder={
                                    "Discover our brand new product dedicated for Marathon"
                                }
                                rows={5}
                                {...field}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {/* todo: icon url field? */}
            {/*URL Field*/}

            <FormField
                control={control}
                name={"payload.data.url"}
                rules={{
                    required: false,
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel weight={"medium"}>Launch URL</FormLabel>
                        <FormControl>
                            <Input
                                length={"medium"}
                                placeholder={"https://nexus.frak.id"}
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
