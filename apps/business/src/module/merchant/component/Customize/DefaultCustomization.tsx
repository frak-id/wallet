import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { Currency } from "@frak-labs/core-sdk";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PreviewWrapper } from "@/module/common/component/PreviewWrapper";
import { Form } from "@/module/forms/Form";
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
import { CssEditor } from "./CssEditor";
import {
    componentsToFormValues,
    formValuesToComponents,
} from "./fields/fieldDefaults";
import { CUSTOM_CSS_ENABLED } from "./flags";
import type {
    ComponentSettingsFormValues,
    ComponentType,
    CssFormValues,
    WordingLang,
} from "./types";
import { valueOrNull } from "./utils";
import { WordingPresets } from "./WordingPresets";

export function DefaultCustomization({
    merchantId,
    sdkConfig,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
}) {
    return (
        <>
            <GlobalComponentsPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
            />
            {CUSTOM_CSS_ENABLED && (
                <GlobalCssPanel merchantId={merchantId} sdkConfig={sdkConfig} />
            )}
        </>
    );
}

const getGlobalComponentsValues = ({
    components,
}: SdkConfig): ComponentSettingsFormValues => ({
    targetInteraction: "",
    ...componentsToFormValues(components),
});

function GlobalComponentsPanel({
    merchantId,
    sdkConfig,
}: {
    merchantId: string;
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
        () => getGlobalComponentsValues(sdkConfig),
        [sdkConfig.components]
    );

    const form = useForm<ComponentSettingsFormValues>({
        values,
    });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (v: ComponentSettingsFormValues) =>
            editSdkConfig({ components: formValuesToComponents(v) }),
        [editSdkConfig]
    );

    useCustomizeSection("default-components", form, onSubmit);

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
                            {t("customize.components.title")}
                        </Text>
                        <Text variant="caption" color="tertiary">
                            {t("customize.components.description")}
                        </Text>
                    </Stack>

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

function GlobalCssPanel({
    merchantId,
    sdkConfig,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
}) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const { mutateAsync: editSdkConfig, isSuccess } = useMerchantUpdate({
        merchantId,
        target: "sdk-config",
    });

    const values = useMemo<CssFormValues>(
        () => ({
            css: sdkConfig.rawCss ?? "",
        }),
        [sdkConfig.rawCss]
    );

    const form = useForm<CssFormValues>({
        values,
        defaultValues: {
            css: "",
        },
    });

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (v: CssFormValues) => editSdkConfig({ rawCss: valueOrNull(v.css) }),
        [editSdkConfig]
    );

    useCustomizeSection("default-css", form, onSubmit);

    return (
        <Card radius="m">
            <Stack space="m">
                <Stack space="xxs">
                    <Text variant="bodySmall" weight="medium" color="secondary">
                        {t("customize.globalCss.title")}
                    </Text>
                    <Text variant="caption" color="tertiary">
                        {t("customize.globalCss.description")}
                    </Text>
                </Stack>
                <AdvancedDisclosure
                    label={t("customize.globalCss.toggle")}
                    isOpen={isOpen}
                    onToggle={() => setIsOpen(!isOpen)}
                >
                    <CssEditor
                        value={form.watch("css")}
                        onChange={(value) => {
                            form.setValue("css", value, {
                                shouldDirty: true,
                            });
                        }}
                        placeholder={".frak-modal { ... }"}
                    />
                </AdvancedDisclosure>
            </Stack>
        </Card>
    );
}
