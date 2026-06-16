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
    WordingLangTabs,
} from "./ComponentEditor";
import { CssEditor } from "./CssEditor";
import { fromLocalizedText, toLocalizedText } from "./localizable";
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
            <GlobalCssPanel merchantId={merchantId} sdkConfig={sdkConfig} />
        </>
    );
}

const getGlobalComponentsValues = ({
    components: c,
}: SdkConfig): ComponentSettingsFormValues => ({
    targetInteraction: "",
    buttonShare: {
        text: toLocalizedText(c?.buttonShare?.text),
        noRewardText: toLocalizedText(c?.buttonShare?.noRewardText),
        clickAction: c?.buttonShare?.clickAction ?? "sharing-page",
        css: c?.buttonShare?.rawCss ?? "",
    },
    postPurchase: {
        refereeText: toLocalizedText(c?.postPurchase?.refereeText),
        refereeNoRewardText: toLocalizedText(
            c?.postPurchase?.refereeNoRewardText
        ),
        referrerText: toLocalizedText(c?.postPurchase?.referrerText),
        referrerNoRewardText: toLocalizedText(
            c?.postPurchase?.referrerNoRewardText
        ),
        ctaText: toLocalizedText(c?.postPurchase?.ctaText),
        ctaNoRewardText: toLocalizedText(c?.postPurchase?.ctaNoRewardText),
        css: c?.postPurchase?.rawCss ?? "",
    },
    banner: {
        referralTitle: toLocalizedText(c?.banner?.referralTitle),
        referralDescription: toLocalizedText(c?.banner?.referralDescription),
        referralCta: toLocalizedText(c?.banner?.referralCta),
        inappTitle: toLocalizedText(c?.banner?.inappTitle),
        inappDescription: toLocalizedText(c?.banner?.inappDescription),
        inappCta: toLocalizedText(c?.banner?.inappCta),
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
    const [activeLang, setActiveLang] = useState<WordingLang>("en");

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
                        text: fromLocalizedText(v.buttonShare.text),
                        noRewardText: fromLocalizedText(
                            v.buttonShare.noRewardText
                        ),
                        clickAction: v.buttonShare.clickAction,
                        rawCss: val(v.buttonShare.css),
                    },
                    postPurchase: {
                        refereeText: fromLocalizedText(
                            v.postPurchase.refereeText
                        ),
                        refereeNoRewardText: fromLocalizedText(
                            v.postPurchase.refereeNoRewardText
                        ),
                        referrerText: fromLocalizedText(
                            v.postPurchase.referrerText
                        ),
                        referrerNoRewardText: fromLocalizedText(
                            v.postPurchase.referrerNoRewardText
                        ),
                        ctaText: fromLocalizedText(v.postPurchase.ctaText),
                        ctaNoRewardText: fromLocalizedText(
                            v.postPurchase.ctaNoRewardText
                        ),
                        rawCss: val(v.postPurchase.css),
                    },
                    banner: {
                        referralTitle: fromLocalizedText(
                            v.banner.referralTitle
                        ),
                        referralDescription: fromLocalizedText(
                            v.banner.referralDescription
                        ),
                        referralCta: fromLocalizedText(v.banner.referralCta),
                        inappTitle: fromLocalizedText(v.banner.inappTitle),
                        inappDescription: fromLocalizedText(
                            v.banner.inappDescription
                        ),
                        inappCta: fromLocalizedText(v.banner.inappCta),
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
                        lang={activeLang}
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
