import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import type { FormMembersFiltering } from "@/module/members/component/MembersFiltering";

export function InteractionsFiltering({
    disabled,
    onSubmit,
}: {
    disabled?: boolean;
    onSubmit: (data: FormMembersFiltering) => void;
}) {
    const { t } = useTranslation();
    const { control, handleSubmit } = useFormContext<FormMembersFiltering>();
    const currentInteractions = useWatch({ control, name: "interactions" });

    return (
        <Stack space="xs">
            <Text as="p" variant="overline" color="secondary">
                {t("members.filters.interactions")}
            </Text>
            <Inline space="m" alignY="bottom">
                <FormField
                    control={control}
                    name={"interactions.min"}
                    disabled={disabled}
                    rules={{
                        required: false,
                        min: {
                            value: 0,
                            message: t("members.filters.minInteractionsError"),
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"} weight={"medium"}>
                                {t("members.filters.min")}
                            </FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={field.value ?? ""}
                                placeholder={t(
                                    "members.filters.minInteractions"
                                )}
                                length={"small"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name={"interactions.max"}
                    disabled={disabled}
                    rules={{
                        required: false,
                        min: {
                            value: 0,
                            message: t("members.filters.maxInteractionsError"),
                        },
                        validate: (value) => {
                            if (
                                !value ||
                                Number.isNaN(value) ||
                                Number.isNaN(currentInteractions?.min)
                            )
                                return;

                            if (
                                Number.parseInt(
                                    currentInteractions?.min as unknown as string,
                                    10
                                ) >=
                                Number.parseInt(value as unknown as string, 10)
                            ) {
                                return t(
                                    "members.filters.maxGreaterThanMinError"
                                );
                            }
                        },
                    }}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel variant={"light"} weight={"medium"}>
                                {t("members.filters.max")}
                            </FormLabel>
                            <Input
                                type={"number"}
                                {...field}
                                value={field.value ?? ""}
                                placeholder={t(
                                    "members.filters.maxInteractions"
                                )}
                                length={"small"}
                                onBlur={handleSubmit(onSubmit)}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </Inline>
        </Stack>
    );
}
