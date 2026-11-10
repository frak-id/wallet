import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField, FormItem } from "@/module/forms/Form";
import { useCustomizeSection } from "../saveRegistry";
import { WordingLangTabs } from "./ComponentEditor";
import * as styles from "./customize.css";
import {
    formValuesToRewardReminder,
    rewardReminderToFormValues,
} from "./rewardReminderForm";
import { SegmentedTabs } from "./SegmentedTabs";
import { SECTION_KEYS } from "./sections";
import type { RewardReminderFormValues, WordingLang } from "./types";
import { useSaveComponents } from "./useSaveComponents";

const POSITIONS = ["left", "right"] as const;
const TEXT_FIELDS = ["title", "description", "cta"] as const;

export function RewardReminderPanel({
    merchantId,
    sdkConfig,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
}) {
    const { t } = useTranslation();
    const { saveComponents, isSuccess } = useSaveComponents(merchantId);
    const [activeLang, setActiveLang] = useState<WordingLang>("default");

    const values = useMemo(
        () => rewardReminderToFormValues(sdkConfig.components?.rewardReminder),
        [sdkConfig.components?.rewardReminder]
    );
    const form = useForm<RewardReminderFormValues>({ values });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const storedReminder = sdkConfig.components?.rewardReminder;
    const onSubmit = useCallback(
        (v: RewardReminderFormValues) =>
            saveComponents({
                rewardReminder: formValuesToRewardReminder(v, storedReminder),
            }),
        [saveComponents, storedReminder]
    );

    useCustomizeSection(SECTION_KEYS.rewardReminder, form, onSubmit);

    return (
        <Form {...form}>
            <Card radius="m">
                <Stack space="m">
                    <Stack space="xxs">
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            color="secondary"
                        >
                            {t("customize.rewardReminder.title")}
                        </Text>
                        <Text variant="caption" color="tertiary">
                            {t("customize.rewardReminder.description")}
                        </Text>
                    </Stack>

                    <FormField
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <FormItem className={styles.switchRow}>
                                <Text variant="body" weight="medium">
                                    {t("customize.rewardReminder.enabled")}
                                </Text>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <Stack space="xs">
                        <Text variant="bodySmall" weight="medium">
                            {t("customize.rewardReminder.position.label")}
                        </Text>
                        <SegmentedTabs
                            value={form.watch("position")}
                            options={POSITIONS}
                            labelFor={(position) =>
                                t(
                                    `customize.rewardReminder.position.${position}`
                                )
                            }
                            onSelect={(position) =>
                                form.setValue("position", position, {
                                    shouldDirty: true,
                                })
                            }
                        />
                    </Stack>

                    <WordingLangTabs
                        selected={activeLang}
                        onSelect={setActiveLang}
                    />
                    <Text variant="caption" color="tertiary">
                        {t("customize.rewardReminder.tokensHint")}
                    </Text>
                    <div className={styles.settingsGrid}>
                        {TEXT_FIELDS.map((field) => (
                            <FormField
                                key={field}
                                control={form.control}
                                name={`${field}.${activeLang}`}
                                render={({ field: input }) => (
                                    <EditField>
                                        <FormControl>
                                            <Input
                                                variant="bare"
                                                tone="muted"
                                                label={t(
                                                    `customize.rewardReminder.fields.${field}`
                                                )}
                                                {...input}
                                            />
                                        </FormControl>
                                    </EditField>
                                )}
                            />
                        ))}
                    </div>
                </Stack>
            </Card>
        </Form>
    );
}
