import { Text } from "@frak-labs/design-system/components/Text";
import { TextArea } from "@frak-labs/design-system/components/TextArea";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditCard } from "@/module/common/component/EditCard";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { FormCreatePushNotification } from "@/module/members/component/CreatePush/types";
import * as styles from "./push-create.css";

const TITLE_MAX = 40;
const MESSAGE_MAX = 500;

/** Required-field marker shown after the label. */
function RequiredMark() {
    return (
        <Text as={"span"} color={"error"}>
            *
        </Text>
    );
}

/**
 * Notification content — the title/message/image/launch-url fields.
 */
export function PushPayloadPanel() {
    const { t } = useTranslation();
    const { control, watch } = useFormContext<FormCreatePushNotification>();
    const [title, message] = watch(["payload.title", "payload.body"]);

    return (
        <EditCard
            title={t("push.create.content.title")}
            description={t("push.create.content.description")}
        >
            <FormField
                control={control}
                name={"payload.title"}
                rules={{
                    required: t(
                        "push.create.content.notificationTitle.required"
                    ),
                    minLength: {
                        value: 8,
                        message: t("push.create.content.notificationTitle.min"),
                    },
                    maxLength: {
                        value: TITLE_MAX,
                        message: t("push.create.content.notificationTitle.max"),
                    },
                }}
                render={({ field }) => (
                    <EditField
                        label={
                            <>
                                {t(
                                    "push.create.content.notificationTitle.label"
                                )}
                                <RequiredMark />
                            </>
                        }
                        hint={t("push.create.charCount", {
                            current: title?.length ?? 0,
                            max: TITLE_MAX,
                        })}
                    >
                        <FormControl>
                            <Input
                                variant={"bare"}
                                tone={"muted"}
                                placeholder={t(
                                    "push.create.content.notificationTitle.placeholder"
                                )}
                                {...field}
                            />
                        </FormControl>
                    </EditField>
                )}
            />
            <FormField
                control={control}
                name={"payload.body"}
                rules={{
                    required: t("push.create.content.message.required"),
                    minLength: {
                        value: 10,
                        message: t("push.create.content.message.min"),
                    },
                    maxLength: {
                        value: MESSAGE_MAX,
                        message: t("push.create.content.message.max"),
                    },
                }}
                render={({ field }) => (
                    <EditField
                        label={
                            <>
                                {t("push.create.content.message.label")}
                                <RequiredMark />
                            </>
                        }
                        hint={t("push.create.charCount", {
                            current: message?.length ?? 0,
                            max: MESSAGE_MAX,
                        })}
                    >
                        <FormControl>
                            <TextArea
                                length={"big"}
                                rows={4}
                                className={styles.messageArea}
                                placeholder={t(
                                    "push.create.content.message.placeholder"
                                )}
                                {...field}
                            />
                        </FormControl>
                    </EditField>
                )}
            />
            <FormField
                control={control}
                name={"payload.icon"}
                render={({ field }) => (
                    <EditField
                        label={t("push.create.content.image.label")}
                        hint={t("push.create.content.image.hint")}
                    >
                        <FormControl>
                            <Input
                                variant={"bare"}
                                tone={"muted"}
                                placeholder={t(
                                    "push.create.content.image.placeholder"
                                )}
                                {...field}
                            />
                        </FormControl>
                    </EditField>
                )}
            />
            <FormField
                control={control}
                name={"payload.data.url"}
                render={({ field }) => (
                    <EditField label={t("push.create.content.launchUrl.label")}>
                        <FormControl>
                            <Input
                                variant={"bare"}
                                tone={"muted"}
                                placeholder={t(
                                    "push.create.content.launchUrl.placeholder"
                                )}
                                {...field}
                            />
                        </FormControl>
                    </EditField>
                )}
            />
        </EditCard>
    );
}
