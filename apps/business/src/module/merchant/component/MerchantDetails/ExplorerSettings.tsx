import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { TextArea } from "@frak-labs/design-system/components/TextArea";
import { ExplorerPhonePreview } from "@frak-labs/ui-preview";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { isValidUrl } from "@/module/common/utils/validateUrl";
import { EditField } from "@/module/forms/EditField";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { Switch } from "@/module/forms/Switch";
import { ImageUploadField } from "@/module/merchant/component/ImageUploadField";
import { MultiHeroImagesField } from "@/module/merchant/component/MultiHeroImagesField";
import { useCustomizeSection } from "@/module/merchant/component/saveRegistry";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { EditCard } from "../EditCard";
import * as styles from "./merchant-details.css";

type ExplorerFormValues = {
    enabled: boolean;
    heroImageUrl?: string;
    heroImageUrls?: string[];
    logoUrl?: string;
    description?: string;
};

export function ExplorerSettings({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });
    const { mutateAsync: editExplorerAsync, isSuccess: editExplorerSuccess } =
        useMerchantUpdate({ merchantId, target: "explorer" });

    const formValues = useMemo(
        () =>
            merchant
                ? {
                      enabled: merchant.explorerEnabledAt !== null,
                      heroImageUrl: merchant.explorerConfig?.heroImageUrl ?? "",
                      heroImageUrls:
                          merchant.explorerConfig?.heroImageUrls ?? [],
                      logoUrl: merchant.explorerConfig?.logoUrl ?? "",
                      description: merchant.explorerConfig?.description ?? "",
                  }
                : undefined,
        [merchant]
    );

    const form = useForm<ExplorerFormValues>({
        values: formValues,
        defaultValues: {
            enabled: false,
            heroImageUrl: "",
            heroImageUrls: [],
            logoUrl: "",
            description: "",
        },
        mode: "onChange",
    });

    useEffect(() => {
        if (!editExplorerSuccess) return;
        form.reset(form.getValues());
    }, [editExplorerSuccess, form]);

    const onValid = useCallback(
        async (values: ExplorerFormValues) => {
            const hasHeroExtras =
                values.heroImageUrls && values.heroImageUrls.length > 0;
            // Empty fields are omitted: the backend validates each value as a
            // URI and replaces the stored config wholesale — always send the
            // object so clearing the last field persists too.
            await editExplorerAsync({
                enabled: values.enabled,
                config: {
                    heroImageUrl: values.heroImageUrl || undefined,
                    heroImageUrls: hasHeroExtras
                        ? values.heroImageUrls
                        : undefined,
                    logoUrl: values.logoUrl || undefined,
                    description: values.description || undefined,
                },
            });
        },
        [editExplorerAsync]
    );

    useCustomizeSection("explorer", form, onValid);

    if (!merchant) return null;

    const watchedHero = form.watch("heroImageUrl");
    const watchedHeroExtras = form.watch("heroImageUrls");
    const watchedLogo = form.watch("logoUrl");
    const watchedDescription = form.watch("description");

    // Feed the preview only with parseable URLs so partial input doesn't
    // replace the mockup imagery mid-typing.
    const previewHero =
        watchedHero && isValidUrl(watchedHero) ? watchedHero : undefined;
    const previewLogo =
        watchedLogo && isValidUrl(watchedLogo) ? watchedLogo : undefined;

    return (
        <>
            <Form {...form}>
                <EditCard title={t("merchantEdit.explorer.title")}>
                    <FormField
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <FormItem>
                                <Inline
                                    space="m"
                                    align="space-between"
                                    alignY="center"
                                    wrap={false}
                                    padding="m"
                                    className={styles.switchRow}
                                >
                                    <Text variant="body" weight="medium">
                                        {t("merchantEdit.explorer.listed")}
                                    </Text>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </Inline>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="heroImageUrl"
                        rules={{
                            validate: (value) =>
                                !value ||
                                isValidUrl(value) ||
                                t("merchantEdit.explorer.invalidUrl"),
                        }}
                        render={({ field }) => (
                            <EditField
                                label={t("merchantEdit.explorer.heroImage")}
                                hint={t("merchantEdit.explorer.heroHint")}
                            >
                                <FormControl>
                                    <ImageUploadField
                                        merchantId={merchantId}
                                        type="hero"
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        onUploadSuccess={(url) =>
                                            form.setValue("heroImageUrl", url, {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            })
                                        }
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="heroImageUrls"
                        render={({ field }) => (
                            <EditField
                                label={t(
                                    "merchantEdit.explorer.additionalHero"
                                )}
                                hint={t(
                                    "merchantEdit.explorer.additionalHeroHint"
                                )}
                            >
                                <FormControl>
                                    <MultiHeroImagesField
                                        merchantId={merchantId}
                                        values={field.value ?? []}
                                        onChange={field.onChange}
                                        excludeUrls={
                                            watchedHero ? [watchedHero] : []
                                        }
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="logoUrl"
                        rules={{
                            validate: (value) =>
                                !value ||
                                isValidUrl(value) ||
                                t("merchantEdit.explorer.invalidUrl"),
                        }}
                        render={({ field }) => (
                            <EditField label={t("merchantEdit.explorer.logo")}>
                                <FormControl>
                                    <ImageUploadField
                                        merchantId={merchantId}
                                        type="logo"
                                        value={field.value ?? ""}
                                        onChange={field.onChange}
                                        onUploadSuccess={(url) =>
                                            form.setValue("logoUrl", url, {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            })
                                        }
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <EditField
                                label={t("merchantEdit.explorer.description")}
                            >
                                <FormControl>
                                    <TextArea
                                        length="big"
                                        resize="none"
                                        className={styles.textareaMuted}
                                        placeholder={t(
                                            "merchantEdit.explorer.descriptionPlaceholder"
                                        )}
                                        {...field}
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />
                </EditCard>
            </Form>
            <div className={styles.phonePreviewFixed}>
                <ExplorerPhonePreview
                    name={merchant.name}
                    heroImageUrl={previewHero}
                    heroImageUrls={watchedHeroExtras}
                    logoUrl={previewLogo}
                    description={watchedDescription || undefined}
                />
            </div>
        </>
    );
}
