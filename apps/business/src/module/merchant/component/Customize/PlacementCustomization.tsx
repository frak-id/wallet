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
    AdvancedDisclosure,
    ComponentFields,
    ComponentImagePicker,
    ComponentPreview,
    ComponentTypeTabs,
    WordingLangTabs,
} from "./ComponentEditor";
import {
    componentsToFormValues,
    formValuesToComponents,
} from "./fields/fieldDefaults";
import { CUSTOM_CSS_ENABLED } from "./flags";
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
            {CUSTOM_CSS_ENABLED && (
                <PlacementCssPanel
                    merchantId={merchantId}
                    placementId={placementId}
                    sdkConfig={sdkConfig}
                />
            )}
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
    return {
        targetInteraction: placement?.targetInteraction ?? "",
        ...componentsToFormValues(placement?.components),
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
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const values = useMemo(
        () => getPlacementFormValues(sdkConfig, placementId),
        [sdkConfig.placements, placementId]
    );

    const form = useForm<ComponentSettingsFormValues>({
        values,
    });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (currentValues: ComponentSettingsFormValues) =>
            editSdkConfig({
                placements: updatePlacement(
                    sdkConfig,
                    placementId,
                    (placement) => ({
                        ...placement,
                        components: {
                            ...placement?.components,
                            ...formValuesToComponents(currentValues),
                        },
                        targetInteraction: valueOrUndefined(
                            currentValues.targetInteraction
                        ),
                    })
                ),
            }),
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
                            configLang={sdkConfig.lang}
                        />
                    </PreviewWrapper>

                    <WordingPresets
                        componentType={selectedComponent}
                        form={form}
                        currency={(sdkConfig.currency ?? "eur") as Currency}
                        shopName={sdkConfig.name ?? "My Store"}
                    />

                    <ComponentImagePicker
                        selectedComponent={selectedComponent}
                        form={form}
                        merchantId={merchantId}
                    />

                    <AdvancedDisclosure
                        label={t("customize.components.advanced")}
                        isOpen={advancedOpen}
                        onToggle={() => setAdvancedOpen(!advancedOpen)}
                    >
                        <ComponentFields
                            selectedComponent={selectedComponent}
                            form={form}
                            lang={activeLang}
                        />
                    </AdvancedDisclosure>
                </Stack>
            </Card>
        </Form>
    );
}
