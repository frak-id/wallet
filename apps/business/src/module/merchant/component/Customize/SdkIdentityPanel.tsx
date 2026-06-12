import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField, FormItem } from "@/module/forms/Form";
import { ImageUploadField } from "@/module/merchant/component/ImageUploadField";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useCustomizeSection } from "../saveRegistry";
import * as styles from "./customize.css";
import type { SdkIdentityFormValues } from "./types";
import { valueOrNull } from "./utils";

/** Radix Select rejects empty-string item values — map "" (auto) to this. */
const AUTO = "auto";

export function SdkIdentityPanel({
    merchantId,
    sdkConfig,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
}) {
    const { t } = useTranslation();
    const { mutateAsync: editSdkConfig, isSuccess: isSuccessUpdate } =
        useMerchantUpdate({ merchantId, target: "sdk-config" });

    const values = useMemo<SdkIdentityFormValues>(
        () => ({
            name: sdkConfig.name ?? "",
            logoUrl: sdkConfig.logoUrl ?? "",
            homepageLink: sdkConfig.homepageLink ?? "",
            currency: sdkConfig.currency ?? "",
            lang: sdkConfig.lang ?? "",
            hidden: sdkConfig.hidden ?? false,
        }),
        [sdkConfig]
    );

    const form = useForm<SdkIdentityFormValues>({
        values,
        defaultValues: {
            name: "",
            logoUrl: "",
            homepageLink: "",
            currency: "",
            lang: "",
            hidden: false,
        },
    });

    useEffect(() => {
        if (!isSuccessUpdate) return;
        form.reset(form.getValues());
    }, [isSuccessUpdate, form]);

    const onSubmit = useCallback(
        (currentValues: SdkIdentityFormValues) =>
            editSdkConfig({
                name: valueOrNull(currentValues.name),
                logoUrl: valueOrNull(currentValues.logoUrl),
                homepageLink: valueOrNull(currentValues.homepageLink),
                currency: currentValues.currency || null,
                lang: currentValues.lang || null,
                hidden: currentValues.hidden,
            }),
        [editSdkConfig]
    );

    useCustomizeSection("identity", form, onSubmit);

    const handleLogoUploadSuccess = useCallback(
        (url: string) => {
            form.setValue("logoUrl", url, { shouldDirty: true });
            form.handleSubmit((v) => onSubmit(v))();
        },
        [form, onSubmit]
    );

    return (
        <Form {...form}>
            <Card radius="m">
                <Stack space="m">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <EditField
                                label={t("customize.identity.name.label")}
                                hint={t("customize.identity.name.hint")}
                            >
                                <FormControl>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        placeholder={t(
                                            "customize.identity.name.placeholder"
                                        )}
                                        {...field}
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="logoUrl"
                        render={({ field }) => (
                            <EditField
                                label={t("customize.identity.logo.label")}
                            >
                                <FormControl>
                                    <ImageUploadField
                                        merchantId={merchantId}
                                        type="logo"
                                        value={field.value}
                                        onChange={field.onChange}
                                        onUploadSuccess={
                                            handleLogoUploadSuccess
                                        }
                                        hint={t("customize.identity.logo.hint")}
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="homepageLink"
                        render={({ field }) => (
                            <EditField
                                label={t("customize.identity.homepage.label")}
                                hint={t("customize.identity.homepage.hint")}
                            >
                                <FormControl>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        placeholder={"https://..."}
                                        {...field}
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                            <EditField
                                label={t("customize.identity.currency.label")}
                                hint={t("customize.identity.currency.hint")}
                            >
                                <Select
                                    value={field.value || AUTO}
                                    onValueChange={(value) =>
                                        field.onChange(
                                            value === AUTO ? "" : value
                                        )
                                    }
                                >
                                    <FormControl>
                                        <SelectTrigger
                                            variant="bare"
                                            tone="muted"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value={AUTO}>
                                            {t(
                                                "customize.identity.currency.auto"
                                            )}
                                        </SelectItem>
                                        <SelectItem value="eur">EUR</SelectItem>
                                        <SelectItem value="usd">USD</SelectItem>
                                        <SelectItem value="gbp">GBP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lang"
                        render={({ field }) => (
                            <EditField
                                label={t("customize.identity.lang.label")}
                                hint={t("customize.identity.lang.hint")}
                            >
                                <Select
                                    value={field.value || AUTO}
                                    onValueChange={(value) =>
                                        field.onChange(
                                            value === AUTO ? "" : value
                                        )
                                    }
                                >
                                    <FormControl>
                                        <SelectTrigger
                                            variant="bare"
                                            tone="muted"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value={AUTO}>
                                            {t("customize.identity.lang.auto")}
                                        </SelectItem>
                                        <SelectItem value="en">
                                            {t("customize.identity.lang.en")}
                                        </SelectItem>
                                        <SelectItem value="fr">
                                            {t("customize.identity.lang.fr")}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="hidden"
                        render={({ field }) => (
                            <FormItem className={styles.switchRow}>
                                <Stack space="xxs">
                                    <Text variant="body" weight="medium">
                                        {t(
                                            "customize.identity.displayed.title"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            "customize.identity.displayed.description"
                                        )}
                                    </Text>
                                </Stack>
                                <FormControl>
                                    <Switch
                                        checked={!field.value}
                                        onCheckedChange={(checked) =>
                                            field.onChange(!checked)
                                        }
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </Stack>
            </Card>
        </Form>
    );
}
