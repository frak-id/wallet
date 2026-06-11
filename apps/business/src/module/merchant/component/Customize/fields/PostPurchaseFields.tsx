import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "../customize.css";
import type {
    ComponentSettingsFormValues,
    PostPurchaseFormValues,
} from "../types";
import { ComponentCssField, WordingTextField } from "./shared";

export function getPostPurchaseDefaults(
    components: NonNullable<
        NonNullable<SdkConfig["placements"]>[string]
    >["components"]
): PostPurchaseFormValues {
    const pp = components?.postPurchase;
    return {
        refereeText: pp?.refereeText ?? "",
        refereeNoRewardText: pp?.refereeNoRewardText ?? "",
        referrerText: pp?.referrerText ?? "",
        referrerNoRewardText: pp?.referrerNoRewardText ?? "",
        ctaText: pp?.ctaText ?? "",
        ctaNoRewardText: pp?.ctaNoRewardText ?? "",
        css: pp?.rawCss ?? "",
    };
}

export function PostPurchaseFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.settingsGrid}>
            <WordingTextField
                form={form}
                name="postPurchase.refereeText"
                label={t("customize.components.fields.refereeText")}
            />
            <WordingTextField
                form={form}
                name="postPurchase.refereeNoRewardText"
                label={t("customize.components.fields.refereeNoRewardText")}
            />
            <WordingTextField
                form={form}
                name="postPurchase.referrerText"
                label={t("customize.components.fields.referrerText")}
            />
            <WordingTextField
                form={form}
                name="postPurchase.referrerNoRewardText"
                label={t("customize.components.fields.referrerNoRewardText")}
            />
            <WordingTextField
                form={form}
                name="postPurchase.ctaText"
                label={t("customize.components.fields.ctaText")}
            />
            <WordingTextField
                form={form}
                name="postPurchase.ctaNoRewardText"
                label={t("customize.components.fields.ctaNoRewardText")}
            />
            <ComponentCssField
                form={form}
                name="postPurchase.css"
                label={t("customize.components.fields.css")}
                placeholder={".post-purchase { ... }"}
            />
        </div>
    );
}
