"use client";

import { Panel } from "@/module/common/component/Panel";
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush";
import { PushPreview } from "@/module/members/component/CreatePush/PushPreview";
import { Column, Columns } from "@module/component/Columns";
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
    const { control, watch } = useFormContext<FormCreatePushNotification>();
    const [title, message, icon] = watch([
        "payload.title",
        "payload.body",
        "payload.icon",
    ]);

    return (
        <Panel title={"Message"}>
            <Columns align={"start"}>
                <Column>
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
                                <FormDescription
                                    label={
                                        <>
                                            Title
                                            <span className={"error"}>*</span>
                                        </>
                                    }
                                />
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
                                message:
                                    "The message require at least 10 characters",
                            },
                            maxLength: {
                                value: 500,
                                message:
                                    "The message can't exceed 500 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormDescription
                                    label={
                                        <>
                                            Message
                                            <span className={"error"}>*</span>
                                        </>
                                    }
                                />
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
                    {/*Image Field*/}
                    <FormField
                        control={control}
                        name={"payload.icon"}
                        rules={{
                            required: false,
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormDescription label={"Image"} />
                                <FormControl>
                                    <Input
                                        length={"medium"}
                                        placeholder={
                                            "https://nexus.frak.id/image.jpg"
                                        }
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {/*URL Field*/}
                    <FormField
                        control={control}
                        name={"payload.data.url"}
                        rules={{
                            required: false,
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormDescription label={"Launch URL"} />
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
                </Column>
                <Column justify={"start"}>
                    <PushPreview
                        title={title !== "" ? title : "Brand new shoes"}
                        message={
                            message !== ""
                                ? message
                                : "Discover our brand new product dedicated for Marathon"
                        }
                        icon={icon}
                    />
                </Column>
            </Columns>
        </Panel>
    );
}
