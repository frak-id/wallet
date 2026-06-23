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
    ComponentPreview,
    ComponentTypeTabs,
} from "./ComponentEditor";
import { CssEditor } from "./CssEditor";
import type {
    ComponentSettingsFormValues,
    ComponentType,
    CssFormValues,
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
            <GlobalCssPanel merchantId={merchantId} sdkConfig={sdkConfig} />
        </>
    );
}

const getGlobalComponentsValues = ({
    components: c,
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Just fallback values
}: SdkConfig): ComponentSettingsFormValues => ({
    targetInteraction: "",
    buttonShare: {
        text: c?.buttonShare?.text ?? "",
        noRewardText: c?.buttonShare?.noRewardText ?? "",
        clickAction: c?.buttonShare?.clickAction ?? "sharing-page",
        css: c?.buttonShare?.rawCss ?? "",
    },
    postPurchase: {
        refereeText: c?.postPurchase?.refereeText ?? "",
        refereeNoRewardText: c?.postPurchase?.refereeNoRewardText ?? "",
        referrerText: c?.postPurchase?.referrerText ?? "",
        referrerNoRewardText: c?.postPurchase?.referrerNoRewardText ?? "",
        ctaText: c?.postPurchase?.ctaText ?? "",
        ctaNoRewardText: c?.postPurchase?.ctaNoRewardText ?? "",
        css: c?.postPurchase?.rawCss ?? "",
    },
    banner: {
        referralTitle: c?.banner?.referralTitle ?? "",
        referralDescription: c?.banner?.referralDescription ?? "",
        referralCta: c?.banner?.referralCta ?? "",
        inappTitle: c?.banner?.inappTitle ?? "",
        inappDescription: c?.banner?.inappDescription ?? "",
        inappCta: c?.banner?.inappCta ?? "",
        css: c?.banner?.rawCss ?? "",
    },
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
        (v: ComponentSettingsFormValues) => {
            const val = (s: string) => s.trim() || undefined;
            return editSdkConfig({
                components: {
                    buttonShare: {
                        text: val(v.buttonShare.text),
                        noRewardText: val(v.buttonShare.noRewardText),
                        clickAction: v.buttonShare.clickAction,
                        rawCss: val(v.buttonShare.css),
                    },
                    postPurchase: {
                        refereeText: val(v.postPurchase.refereeText),
                        refereeNoRewardText: val(
                            v.postPurchase.refereeNoRewardText
                        ),
                        referrerText: val(v.postPurchase.referrerText),
                        referrerNoRewardText: val(
                            v.postPurchase.referrerNoRewardText
                        ),
                        ctaText: val(v.postPurchase.ctaText),
                        ctaNoRewardText: val(v.postPurchase.ctaNoRewardText),
                        rawCss: val(v.postPurchase.css),
                    },
                    banner: {
                        referralTitle: val(v.banner.referralTitle),
                        referralDescription: val(v.banner.referralDescription),
                        referralCta: val(v.banner.referralCta),
                        inappTitle: val(v.banner.inappTitle),
                        inappDescription: val(v.banner.inappDescription),
                        inappCta: val(v.banner.inappCta),
                        rawCss: val(v.banner.css),
                    },
                },
            });
        },
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
