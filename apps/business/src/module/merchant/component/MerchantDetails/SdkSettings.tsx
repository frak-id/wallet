import { Input } from "@frak-labs/ui/component/forms/Input";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Panel } from "@/module/common/component/Panel";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import { FormActions } from "@/module/forms/FormActions";
import { InputWithToggle } from "@/module/forms/InputWithToggle";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import { useSdkConfig } from "@/module/merchant/hook/useSdkConfig";
import styles from "./index.module.css";

type TranslationLang = "default" | "en" | "fr";

type SdkSettingsFormValues = {
    name: string;
    logoUrl: string;
    homepageLink: string;
    currency: string;
    lang: string;
    css: string;
    translationsDefault: Record<string, string>;
    translationsEn: Record<string, string>;
    translationsFr: Record<string, string>;
};

const TRANSLATION_KEYS = {
    "modal.dismiss": [
        "sdk.modal.dismiss.primaryAction",
        "sdk.modal.dismiss.primaryAction_sharing",
    ],
    "modal.final": [
        "sdk.modal.final.title",
        "sdk.modal.final.title_reward",
        "sdk.modal.final.title_sharing",
        "sdk.modal.final.description",
        "sdk.modal.final.description_sharing",
        "sdk.modal.final.description_reward",
        "sdk.modal.final.dismissed.description",
        "sdk.modal.final.dismissed.description_sharing",
    ],
    "modal.login": [
        "sdk.modal.login.description",
        "sdk.modal.login.description_sharing",
        "sdk.modal.login.description_reward",
        "sdk.modal.login.primaryAction",
        "sdk.modal.login.secondaryAction",
        "sdk.modal.login.title",
        "sdk.modal.login.success",
    ],
    "modal.sendTransaction": [
        "sdk.modal.sendTransaction.description",
        "sdk.modal.sendTransaction.primaryAction_one",
        "sdk.modal.sendTransaction.primaryAction_other",
        "sdk.modal.sendTransaction.title",
    ],
    "modal.siweAuthenticate": [
        "sdk.modal.siweAuthenticate.description",
        "sdk.modal.siweAuthenticate.primaryAction",
        "sdk.modal.siweAuthenticate.title",
    ],
    "wallet.login": [
        "sdk.wallet.login.text",
        "sdk.wallet.login.text_referred",
        "sdk.wallet.login.primaryAction",
    ],
    "wallet.loggedIn": [
        "sdk.wallet.loggedIn.onboarding.welcome",
        "sdk.wallet.loggedIn.onboarding.share",
        "sdk.wallet.loggedIn.onboarding.share_referred",
    ],
};

function flattenRecord(
    obj: Record<string, unknown>,
    prefix = ""
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") {
            if (value !== "") result[fullKey] = value;
        } else if (typeof value === "object" && value !== null) {
            Object.assign(
                result,
                flattenRecord(value as Record<string, unknown>, fullKey)
            );
        }
    }
    return result;
}

function valueOrNull(value: string): string | null {
    return value === "" ? null : value;
}

function buildSdkConfigPayload(values: SdkSettingsFormValues) {
    const config: Record<string, unknown> = {};
    config.name = valueOrNull(values.name);
    config.logoUrl = valueOrNull(values.logoUrl);
    config.homepageLink = valueOrNull(values.homepageLink);
    config.currency = valueOrNull(values.currency);
    config.lang = valueOrNull(values.lang);
    config.css = valueOrNull(values.css);

    const translations: Record<string, Record<string, string>> = {};
    const defaultOverrides = flattenRecord(
        values.translationsDefault as Record<string, unknown>
    );
    const enOverrides = flattenRecord(
        values.translationsEn as Record<string, unknown>
    );
    const frOverrides = flattenRecord(
        values.translationsFr as Record<string, unknown>
    );
    if (Object.keys(defaultOverrides).length > 0)
        translations.default = defaultOverrides;
    if (Object.keys(enOverrides).length > 0) translations.en = enOverrides;
    if (Object.keys(frOverrides).length > 0) translations.fr = frOverrides;
    if (Object.keys(translations).length > 0)
        config.translations = translations;

    return config;
}

export function SdkSettings({ merchantId }: { merchantId: string }) {
    const { data: sdkConfigData } = useSdkConfig({ merchantId });
    const {
        mutate: editSdkConfig,
        isSuccess: editSuccess,
        isPending: editPending,
    } = useMerchantUpdate({ merchantId, target: "sdk-config" });

    const [translationLang, setTranslationLang] =
        useState<TranslationLang>("default");

    const formValues = useMemo(
        () =>
            sdkConfigData
                ? {
                      name: sdkConfigData.sdkConfig?.name ?? "",
                      logoUrl: sdkConfigData.sdkConfig?.logoUrl ?? "",
                      homepageLink: sdkConfigData.sdkConfig?.homepageLink ?? "",
                      currency: sdkConfigData.sdkConfig?.currency ?? "",
                      lang: sdkConfigData.sdkConfig?.lang ?? "",
                      css: sdkConfigData.sdkConfig?.css ?? "",
                      translationsDefault:
                          sdkConfigData.sdkConfig?.translations?.default ?? {},
                      translationsEn:
                          sdkConfigData.sdkConfig?.translations?.en ?? {},
                      translationsFr:
                          sdkConfigData.sdkConfig?.translations?.fr ?? {},
                  }
                : undefined,
        [sdkConfigData]
    );

    const form = useForm<SdkSettingsFormValues>({
        values: formValues,
        defaultValues: {
            name: "",
            logoUrl: "",
            homepageLink: "",
            currency: "",
            lang: "",
            css: "",
            translationsDefault: {},
            translationsEn: {},
            translationsFr: {},
        },
    });

    useEffect(() => {
        if (!editSuccess) return;
        form.reset(form.getValues());
    }, [editSuccess, form.reset, form.getValues, form]);

    function onSubmit(values: SdkSettingsFormValues) {
        editSdkConfig(buildSdkConfigPayload(values));
    }

    if (!sdkConfigData) return null;

    const actions = (
        <FormActions
            isSuccess={editSuccess}
            isPending={editPending}
            isDirty={form.formState.isDirty}
            onDiscard={() => form.reset(formValues)}
            onSubmit={() => form.handleSubmit(onSubmit)()}
        />
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
                            <FormControl>
                                <InputWithToggle
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
                            <FormControl>
                                <InputWithToggle
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
                            <FormControl>
                                <InputWithToggle
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
                            <FormControl>
                                <select className={styles.select} {...field}>
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
                            <FormControl>
                                <select className={styles.select} {...field}>
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
                {actions}
            </Panel>

            <Panel title={"Custom CSS"}>
                <FormField
                    control={form.control}
                    name="css"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel weight={"medium"}>
                                CSS Overrides
                            </FormLabel>
                            <FormControl>
                                <textarea
                                    className={styles.textarea}
                                    placeholder={".frak-modal { ... }"}
                                    style={{
                                        width: "100%",
                                        minHeight: "200px",
                                        fontFamily: "monospace",
                                    }}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {actions}
            </Panel>

            <Panel title={"Translation Overrides"}>
                <div className={styles.translationLangTabs}>
                    <button
                        type="button"
                        className={`${styles.translationLangTab} ${translationLang === "default" ? styles["translationLangTab--active"] : ""}`}
                        onClick={() => setTranslationLang("default")}
                    >
                        Default (all languages)
                    </button>
                    <button
                        type="button"
                        className={`${styles.translationLangTab} ${translationLang === "en" ? styles["translationLangTab--active"] : ""}`}
                        onClick={() => setTranslationLang("en")}
                    >
                        English (EN)
                    </button>
                    <button
                        type="button"
                        className={`${styles.translationLangTab} ${translationLang === "fr" ? styles["translationLangTab--active"] : ""}`}
                        onClick={() => setTranslationLang("fr")}
                    >
                        French (FR)
                    </button>
                </div>

                {Object.entries(TRANSLATION_KEYS).map(([group, keys]) => (
                    <div key={group}>
                        <div className={styles.translationGroup}>{group}</div>
                        {keys.map((key) => (
                            <FormField
                                key={key}
                                control={form.control}
                                name={
                                    // biome-ignore lint/suspicious/noExplicitAny: dynamic field name
                                    `translations${translationLang === "default" ? "Default" : translationLang === "en" ? "En" : "Fr"}.${key}` as any
                                }
                                render={({ field }) => (
                                    <FormItem className={styles.translationRow}>
                                        <FormLabel>{key}</FormLabel>
                                        <FormControl>
                                            <Input
                                                length={"big"}
                                                placeholder={`Default ${translationLang.toUpperCase()} text`}
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                ))}

                {actions}
            </Panel>
        </Form>
    );
}
