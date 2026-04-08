import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import { Form } from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import styles from "./index.module.css";
import { LoginPreview } from "./ModalPreview";
import { CssEditor, TranslationEditor } from "./TranslationEditor";
import type {
    CssFormValues,
    TranslationFormValues,
    TranslationLang,
} from "./types";
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
            <GlobalCssPanel
                merchantId={merchantId}
                sdkConfig={sdkConfig}
                onDirtyChange={onDirtyChange}
            />
            <GlobalTranslationsPanel
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
            <CssEditor
                value={form.watch("css")}
                onChange={(value) => {
                    form.setValue("css", value, { shouldDirty: true });
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
                <LoginPreview
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
