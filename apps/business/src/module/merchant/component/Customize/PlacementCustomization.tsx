import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { Currency } from "@frak-labs/core-sdk";
import { Card } from "@frak-labs/design-system/components/Card";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PreviewWrapper } from "@/module/common/component/PreviewWrapper";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import {
    ComponentFields,
    ComponentPreview,
    ComponentTypeTabs,
} from "./ComponentEditor";
import * as styles from "./customize.css";
import { getBannerDefaults } from "./fields/BannerFields";
import { getPostPurchaseDefaults } from "./fields/PostPurchaseFields";
import { DeletePlacementPanel, PlacementCssPanel } from "./PlacementPanels";
import { useCustomizeSection } from "./saveRegistry";
import type { ComponentSettingsFormValues, ComponentType } from "./types";
import { updatePlacement, valueOrUndefined } from "./utils";
import { WordingPresets } from "./WordingPresets";

export function PlacementCustomization({
    merchantId,
    placementId,
    sdkConfig,
    onSelectDefaultTab,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
    onSelectDefaultTab: () => void;
}) {
    const placement = sdkConfig.placements?.[placementId];

    if (!placement) return null;

    return (
        <>
            <PlacementSettingsPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
            />
            <PlacementCssPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
            />
            <DeletePlacementPanel
                merchantId={merchantId}
                placementId={placementId}
                sdkConfig={sdkConfig}
                onDelete={onSelectDefaultTab}
            />
        </>
    );
}

function getPlacementFormValues(
    sdkConfig: SdkConfig,
    placementId: string
): ComponentSettingsFormValues {
    const placement = sdkConfig.placements?.[placementId];
    const components = placement?.components;
    const bs = components?.buttonShare;
    return {
        targetInteraction: placement?.targetInteraction ?? "",
        buttonShare: {
            text: bs?.text ?? "",
            noRewardText: bs?.noRewardText ?? "",
            clickAction: bs?.clickAction ?? "sharing-page",
            css: bs?.rawCss ?? "",
        },
        postPurchase: getPostPurchaseDefaults(components),
        banner: getBannerDefaults(components),
    };
}

function PlacementSettingsPanel({
    merchantId,
    placementId,
    sdkConfig,
}: {
    merchantId: string;
    placementId: string;
    sdkConfig: SdkConfig;
}) {
    const { t } = useTranslation();
    const { mutateAsync: editSdkConfig, isSuccess } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });

    const [selectedComponent, setSelectedComponent] =
        useState<ComponentType>("buttonShare");

    const values = useMemo(
        () => getPlacementFormValues(sdkConfig, placementId),
        [sdkConfig.placements, placementId]
    );

    const form = useForm<ComponentSettingsFormValues>({
        values,
        defaultValues: {
            targetInteraction: "",
            buttonShare: {
                text: "",
                noRewardText: "",
                clickAction: "sharing-page",
                css: "",
            },
            postPurchase: {
                refereeText: "",
                refereeNoRewardText: "",
                referrerText: "",
                referrerNoRewardText: "",
                ctaText: "",
                ctaNoRewardText: "",
                css: "",
            },
            banner: {
                referralTitle: "",
                referralDescription: "",
                referralCta: "",
                inappTitle: "",
                inappDescription: "",
                inappCta: "",
                css: "",
            },
        },
    });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (currentValues: ComponentSettingsFormValues) => {
            const buttonShare = {
                text: valueOrUndefined(currentValues.buttonShare.text),
                noRewardText: valueOrUndefined(
                    currentValues.buttonShare.noRewardText
                ),
                clickAction: currentValues.buttonShare.clickAction,
                rawCss: valueOrUndefined(currentValues.buttonShare.css),
            };
            const postPurchase = {
                refereeText: valueOrUndefined(
                    currentValues.postPurchase.refereeText
                ),
                refereeNoRewardText: valueOrUndefined(
                    currentValues.postPurchase.refereeNoRewardText
                ),
                referrerText: valueOrUndefined(
                    currentValues.postPurchase.referrerText
                ),
                referrerNoRewardText: valueOrUndefined(
                    currentValues.postPurchase.referrerNoRewardText
                ),
                ctaText: valueOrUndefined(currentValues.postPurchase.ctaText),
                ctaNoRewardText: valueOrUndefined(
                    currentValues.postPurchase.ctaNoRewardText
                ),
                rawCss: valueOrUndefined(currentValues.postPurchase.css),
            };
            const banner = {
                referralTitle: valueOrUndefined(
                    currentValues.banner.referralTitle
                ),
                referralDescription: valueOrUndefined(
                    currentValues.banner.referralDescription
                ),
                referralCta: valueOrUndefined(currentValues.banner.referralCta),
                inappTitle: valueOrUndefined(currentValues.banner.inappTitle),
                inappDescription: valueOrUndefined(
                    currentValues.banner.inappDescription
                ),
                inappCta: valueOrUndefined(currentValues.banner.inappCta),
                rawCss: valueOrUndefined(currentValues.banner.css),
            };

            return editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        components: {
                            ...placement?.components,
                            buttonShare,
                            postPurchase,
                            banner,
                        },
                        targetInteraction: valueOrUndefined(
                            currentValues.targetInteraction
                        ),
                    })
                ),
            });
        },
        [editSdkConfig, sdkConfig, placementId]
    );

    useCustomizeSection(`placement-${placementId}-settings`, form, onSubmit);

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
                            {t("customize.placements.settings.title", {
                                placementId,
                            })}
                        </Text>
                        <Text variant="caption" color="tertiary">
                            {t("customize.placements.settings.description")}
                        </Text>
                    </Stack>

                    <FormField
                        control={form.control}
                        name="targetInteraction"
                        rules={{
                            maxLength: {
                                value: 200,
                                message: t(
                                    "customize.components.targetInteraction.error"
                                ),
                            },
                        }}
                        render={({ field }) => (
                            <FormItem className={styles.fieldItem}>
                                <FormLabel className={styles.fieldLabel}>
                                    {t(
                                        "customize.components.targetInteraction.label"
                                    )}
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        maxLength={200}
                                        placeholder={"purchase_completed"}
                                        {...field}
                                    />
                                </FormControl>
                                <p className={styles.fieldHint}>
                                    {t(
                                        "customize.components.targetInteraction.hint"
                                    )}
                                </p>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <ComponentTypeTabs
                        selected={selectedComponent}
                        onSelect={setSelectedComponent}
                    />

                    <PreviewWrapper label={t("customize.components.preview")}>
                        <ComponentPreview
                            selectedComponent={selectedComponent}
                            form={form}
                            currency={(sdkConfig.currency ?? "eur") as Currency}
                            shopName={sdkConfig.name ?? "My Store"}
                        />
                    </PreviewWrapper>

                    <WordingPresets
                        componentType={selectedComponent}
                        form={form}
                        currency={(sdkConfig.currency ?? "eur") as Currency}
                        shopName={sdkConfig.name ?? "My Store"}
                    />

                    <ComponentFields
                        selectedComponent={selectedComponent}
                        form={form}
                    />
                </Stack>
            </Card>
        </Form>
    );
}
