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
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useCustomizeSection } from "../saveRegistry";
import {
    ComponentFields,
    ComponentPreview,
    ComponentTypeTabs,
    WordingLangTabs,
} from "./ComponentEditor";
import {
    getBannerDefaults,
    getPostPurchaseDefaults,
} from "./fields/fieldDefaults";
import { fromLocalizedText, toLocalizedText } from "./localizable";
import { DeletePlacementPanel, PlacementCssPanel } from "./PlacementPanels";
import type {
    ComponentSettingsFormValues,
    ComponentType,
    WordingLang,
} from "./types";
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
            text: toLocalizedText(bs?.text),
            noRewardText: toLocalizedText(bs?.noRewardText),
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
    const [activeLang, setActiveLang] = useState<WordingLang>("default");

    const values = useMemo(
        () => getPlacementFormValues(sdkConfig, placementId),
        [sdkConfig.placements, placementId]
    );

    const form = useForm<ComponentSettingsFormValues>({
        values,
        defaultValues: {
            targetInteraction: "",
            buttonShare: {
                text: toLocalizedText(undefined),
                noRewardText: toLocalizedText(undefined),
                clickAction: "sharing-page",
                css: "",
            },
            postPurchase: {
                refereeText: toLocalizedText(undefined),
                refereeNoRewardText: toLocalizedText(undefined),
                referrerText: toLocalizedText(undefined),
                referrerNoRewardText: toLocalizedText(undefined),
                ctaText: toLocalizedText(undefined),
                ctaNoRewardText: toLocalizedText(undefined),
                css: "",
            },
            banner: {
                referralTitle: toLocalizedText(undefined),
                referralDescription: toLocalizedText(undefined),
                referralCta: toLocalizedText(undefined),
                inappTitle: toLocalizedText(undefined),
                inappDescription: toLocalizedText(undefined),
                inappCta: toLocalizedText(undefined),
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
                text: fromLocalizedText(currentValues.buttonShare.text),
                noRewardText: fromLocalizedText(
                    currentValues.buttonShare.noRewardText
                ),
                clickAction: currentValues.buttonShare.clickAction,
                rawCss: valueOrUndefined(currentValues.buttonShare.css),
            };
            const postPurchase = {
                refereeText: fromLocalizedText(
                    currentValues.postPurchase.refereeText
                ),
                refereeNoRewardText: fromLocalizedText(
                    currentValues.postPurchase.refereeNoRewardText
                ),
                referrerText: fromLocalizedText(
                    currentValues.postPurchase.referrerText
                ),
                referrerNoRewardText: fromLocalizedText(
                    currentValues.postPurchase.referrerNoRewardText
                ),
                ctaText: fromLocalizedText(currentValues.postPurchase.ctaText),
                ctaNoRewardText: fromLocalizedText(
                    currentValues.postPurchase.ctaNoRewardText
                ),
                rawCss: valueOrUndefined(currentValues.postPurchase.css),
            };
            const banner = {
                referralTitle: fromLocalizedText(
                    currentValues.banner.referralTitle
                ),
                referralDescription: fromLocalizedText(
                    currentValues.banner.referralDescription
                ),
                referralCta: fromLocalizedText(
                    currentValues.banner.referralCta
                ),
                inappTitle: fromLocalizedText(currentValues.banner.inappTitle),
                inappDescription: fromLocalizedText(
                    currentValues.banner.inappDescription
                ),
                inappCta: fromLocalizedText(currentValues.banner.inappCta),
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
                            <EditField
                                label={t(
                                    "customize.components.targetInteraction.label"
                                )}
                                hint={t(
                                    "customize.components.targetInteraction.hint"
                                )}
                            >
                                <FormControl>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        maxLength={200}
                                        placeholder={"purchase_completed"}
                                        {...field}
                                    />
                                </FormControl>
                            </EditField>
                        )}
                    />

                    <ComponentTypeTabs
                        selected={selectedComponent}
                        onSelect={setSelectedComponent}
                    />

                    <WordingLangTabs
                        selected={activeLang}
                        onSelect={setActiveLang}
                    />

                    <PreviewWrapper label={t("customize.components.preview")}>
                        <ComponentPreview
                            selectedComponent={selectedComponent}
                            form={form}
                            currency={(sdkConfig.currency ?? "eur") as Currency}
                            shopName={sdkConfig.name ?? "My Store"}
                            lang={activeLang}
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
                        lang={activeLang}
                    />
                </Stack>
            </Card>
        </Form>
    );
}
