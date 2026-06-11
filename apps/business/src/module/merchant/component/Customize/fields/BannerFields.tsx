import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as styles from "../customize.css";
import type { BannerFormValues, ComponentSettingsFormValues } from "../types";
import { ComponentCssField, WordingTextField } from "./shared";

export function getBannerDefaults(
    components: NonNullable<
        NonNullable<SdkConfig["placements"]>[string]
    >["components"]
): BannerFormValues {
    const b = components?.banner;
    return {
        referralTitle: b?.referralTitle ?? "",
        referralDescription: b?.referralDescription ?? "",
        referralCta: b?.referralCta ?? "",
        inappTitle: b?.inappTitle ?? "",
        inappDescription: b?.inappDescription ?? "",
        inappCta: b?.inappCta ?? "",
        css: b?.rawCss ?? "",
    };
}

export function BannerFields({
    form,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <div className={styles.settingsGrid}>
            <WordingTextField
                form={form}
                name="banner.referralTitle"
                label={t("customize.components.fields.referralTitle")}
            />
            <WordingTextField
                form={form}
                name="banner.referralDescription"
                label={t("customize.components.fields.referralDescription")}
            />
            <WordingTextField
                form={form}
                name="banner.referralCta"
                label={t("customize.components.fields.referralCta")}
            />
            <WordingTextField
                form={form}
                name="banner.inappTitle"
                label={t("customize.components.fields.inappTitle")}
            />
            <WordingTextField
                form={form}
                name="banner.inappDescription"
                label={t("customize.components.fields.inappDescription")}
            />
            <WordingTextField
                form={form}
                name="banner.inappCta"
                label={t("customize.components.fields.inappCta")}
            />
            <ComponentCssField
                form={form}
                name="banner.css"
                label={t("customize.components.fields.css")}
                placeholder={".frak-banner { ... }"}
            />
        </div>
    );
}
