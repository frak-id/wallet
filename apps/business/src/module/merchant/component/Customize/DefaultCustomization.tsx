import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { Currency } from "@frak-labs/core-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import { PreviewWrapper } from "@/module/common/component/PreviewWrapper";
import { Form } from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { BannerFields } from "./fields/BannerFields";
import { ButtonShareFields } from "./fields/ButtonShareFields";
import { PostPurchaseFields } from "./fields/PostPurchaseFields";
import styles from "./index.module.css";
import { SharingPagePreview } from "./ModalPreview";
import { ComponentPreview } from "./PlacementCustomization";
import { CssEditor, TranslationEditor } from "./TranslationEditor";
import { COMPONENT_LABELS } from "./translations";
import type {
    ComponentSettingsFormValues,
    ComponentType,
    CssFormValues,
    TranslationFormValues,
    TranslationLang,
} from "./types";
import { COMPONENT_TYPES } from "./types";
import {
    buildTranslationsPayload,
    getTranslationsFormValues,
    valueOrNull,
} from "./utils";

export function DefaultCustomization({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    return (
        <>
            <GlobalComponentsPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <GlobalTranslationsPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <GlobalCssPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
        </>
    );
}

function GlobalCssPanel({
    merchantId,
    sdkConfig,
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

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
        onDirtyChange("default-css", form.formState.isDirty);
        return () => onDirtyChange("default-css", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Panel title={"Global CSS"}>
            <p className={styles.customize__fieldDescription}>
                CSS styles applied to all SDK components across every placement.
                Placement-level CSS can override these defaults.
            </p>
            <div className={styles.customize__advancedSection}>
                <button
                    type="button"
                    className={styles.customize__advancedToggle}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? "▾" : "▸"} Custom CSS
                </button>
                {isOpen && (
                    <div className={styles.customize__advancedBody}>
                        <CssEditor
                            value={form.watch("css")}
                            onChange={(value) => {
                                form.setValue("css", value, {
                                    shouldDirty: true,
                                });
                            }}
                            placeholder={".frak-modal { ... }"}
                            isPending={isPending}
                            isSuccess={isSuccess}
                            isDirty={form.formState.isDirty}
                            onDiscard={() => form.reset(values)}
                            onSave={() =>
                                editSdkConfig({
                                    rawCss: valueOrNull(form.getValues("css")),
                                })
                            }
                        />
                    </div>
                )}
            </div>
        </Panel>
    );
}

function GlobalTranslationsPanel({
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
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });
    const [lang, setLang] = useState<TranslationLang>("default");

    const values = useMemo<TranslationFormValues>(
        () => getTranslationsFormValues(sdkConfig.translations),
        [sdkConfig.translations]
    );

    const form = useForm<TranslationFormValues>({
        values,
        defaultValues: {
            translationsDefault: {},
            translationsEn: {},
            translationsFr: {},
        },
    });

    useEffect(() => {
        onDirtyChange("default-translations", form.formState.isDirty);
        return () => onDirtyChange("default-translations", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    return (
        <Form {...form}>
            <Panel title={"Global translations"}>
                <p className={styles.customize__fieldDescription}>
                    Translations applied to all SDK components across every
                    placement.
                </p>
                <SharingPagePreview
                    form={form}
                    logoUrl={sdkConfig.logoUrl ?? undefined}
                    currency={sdkConfig.currency ?? undefined}
                    lang={lang}
                />
                <TranslationEditor
                    form={form}
                    fieldPrefix={"translations"}
                    lang={lang}
                    onLangChange={setLang}
                />
                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => {
                        const payload = buildTranslationsPayload(
                            form.getValues()
                        );
                        editSdkConfig({
                            translations: payload.hasAnyValues
                                ? payload.translations
                                : null,
                        });
                    }}
                />
            </Panel>
        </Form>
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
        useReward: c?.buttonShare?.useReward ?? false,
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
    onDirtyChange,
}: {
    merchantId: string;
    sdkConfig: SdkConfig;
    onDirtyChange: (key: string, isDirty: boolean) => void;
}) {
    const {
        mutate: editSdkConfig,
        isPending,
        isSuccess,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

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
        onDirtyChange("default-components", form.formState.isDirty);
        return () => onDirtyChange("default-components", false);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!isSuccess) return;
        form.reset(form.getValues());
    }, [isSuccess, form.reset, form.getValues, form]);

    const onSubmit = useCallback(
        (v: ComponentSettingsFormValues) => {
            const val = (s: string) => s.trim() || undefined;
            editSdkConfig({
                components: {
                    buttonShare: {
                        text: val(v.buttonShare.text),
                        noRewardText: val(v.buttonShare.noRewardText),
                        clickAction: v.buttonShare.clickAction,
                        useReward: v.buttonShare.useReward,
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

    return (
        <Form {...form}>
            <Panel title={"Global component defaults"}>
                <p className={styles.customize__fieldDescription}>
                    Default text and styles for SDK components. Placement-level
                    settings override these values.
                </p>

                <div className={styles.customize__componentSelector}>
                    {COMPONENT_TYPES.map((componentType) => (
                        <button
                            key={componentType}
                            type="button"
                            className={`${styles.customize__tab} ${
                                selectedComponent === componentType
                                    ? styles["customize__tab--active"]
                                    : ""
                            }`}
                            onClick={() => setSelectedComponent(componentType)}
                        >
                            {COMPONENT_LABELS[componentType]}
                        </button>
                    ))}
                </div>

                <PreviewWrapper>
                    <ComponentPreview
                        selectedComponent={selectedComponent}
                        form={form}
                        currency={(sdkConfig.currency ?? "eur") as Currency}
                        shopName={sdkConfig.name ?? "My Store"}
                    />
                </PreviewWrapper>

                {selectedComponent === "buttonShare" && (
                    <ButtonShareFields form={form} />
                )}
                {selectedComponent === "postPurchase" && (
                    <PostPurchaseFields form={form} />
                )}
                {selectedComponent === "banner" && <BannerFields form={form} />}

                <FormActions
                    isSuccess={isSuccess}
                    isPending={isPending}
                    isDirty={form.formState.isDirty}
                    onDiscard={() => form.reset(values)}
                    onSubmit={() => form.handleSubmit(onSubmit)()}
                />
            </Panel>
        </Form>
    );
}
