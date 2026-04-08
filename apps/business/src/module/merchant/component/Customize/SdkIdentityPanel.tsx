import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { Switch } from "@/module/forms/Switch";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import styles from "./index.module.css";
import type { SdkIdentityFormValues } from "./types";
import { valueOrNull } from "./utils";

export function SdkIdentityPanel({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending: isPendingUpdate,
        isSuccess: isSuccessUpdate,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

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
        onDirtyChange("identity", form.formState.isDirty);
        return () => onDirtyChange("identity", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccessUpdate) return;
        form.reset(form.getValues());
    }, [isSuccessUpdate, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (currentValues: SdkIdentityFormValues) => {
            editSdkConfig({
                name: valueOrNull(currentValues.name),
                logoUrl: valueOrNull(currentValues.logoUrl),
                homepageLink: valueOrNull(currentValues.homepageLink),
                currency: currentValues.currency || null,
                lang: currentValues.lang || null,
                hidden: currentValues.hidden,
            });
        },
        [editSdkConfig]
    );

    return (
        <Form {...form}>
            <Panel title={"SDK Identity"}>
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Name</FormLabel>
                            <FormDescription>
                                Your brand name as shown to visitors in the SDK
                                components
                            </FormDescription>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"Merchant Name"}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Logo URL</FormLabel>
                            <FormDescription>
                                URL to your logo image, displayed alongside your
                                name in SDK components
                            </FormDescription>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"https://..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="homepageLink"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>
                                Homepage Link
                            </FormLabel>
                            <FormDescription>
                                Your website URL, used when visitors click your
                                brand name
                            </FormDescription>
                            <FormControl>
                                <Input
                                    length={"medium"}
                                    placeholder={"https://..."}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Currency</FormLabel>
                            <FormDescription>
                                Currency used to display reward amounts
                            </FormDescription>
                            <FormControl>
                                <select
                                    className={styles.customize__select}
                                    {...field}
                                >
                                    <option value="">Auto</option>
                                    <option value="eur">EUR</option>
                                    <option value="usd">USD</option>
                                    <option value="gbp">GBP</option>
                                </select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="lang"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>Language</FormLabel>
                            <FormDescription>
                                Language for SDK text. Auto detects from the
                                visitor&apos;s browser.
                            </FormDescription>
                            <FormControl>
                                <select
                                    className={styles.customize__select}
                                    {...field}
                                >
                                    <option value="">
                                        Auto (Browser detection)
                                    </option>
                                    <option value="en">English</option>
                                    <option value="fr">French</option>
                                </select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="hidden"
                    render={({ field }) => (
                        <FormItem className={styles.customize__switchRow}>
                            <FormLabel weight={"medium"}>
                                Frak SDK displayed
                            </FormLabel>
                            <FormDescription>
                                When off, the SDK is completely hidden from
                                visitors
                            </FormDescription>
                            <FormControl>
                                <Switch
                                    checked={!field.value}
                                    onCheckedChange={(checked) =>
                                        field.onChange(!checked)
                                    }
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormActions
                    isSuccess={isSuccessUpdate}
                    isPending={isPendingUpdate}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => form.handleSubmit(onSubmit)()}
                />
            </Panel>
        </Form>
    );
}
