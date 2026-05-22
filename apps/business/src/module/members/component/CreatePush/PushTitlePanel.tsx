import {
    Card,
    CardHeader,
    CardTitle,
} from "@frak-labs/design-system/components/Card";
import { useFormContext } from "react-hook-form";
import {
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";

/**
 * Audience panel
 * @constructor
 */
export function PushTitlePanel() {
    const form = useFormContext<FormCreatePushNotification>();
    return (
        <Card>
            <CardHeader>
                <CardTitle>Push Notification Title</CardTitle>
            </CardHeader>
            <FormField
                control={form.control}
                name={"pushCampaignTitle"}
                rules={{
                    required: "Push campaign title is required",
                    minLength: {
                        value: 5,
                        message:
                            "The push campaign title require at least 5 characters",
                    },
                    maxLength: {
                        value: 100,
                        message:
                            "The push campaign title can't exceed 40 characters",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
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
        </Card>
    );
}
