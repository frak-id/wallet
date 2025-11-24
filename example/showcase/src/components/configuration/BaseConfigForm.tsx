import { Input } from "@frak-labs/ui/component/forms/Input";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/forms/Select";
import { useConfigStore } from "@/stores/configStore";
import { currencies } from "@/utils/currencies";
import { languages } from "@/utils/languages";
import styles from "./BaseConfigForm.module.css";

type BaseConfigFormData = {
    name: string;
    lang: "auto" | "en" | "fr";
    currency: "eur" | "usd" | "gbp";
    logoUrl?: string;
    homepageLink?: string;
};

export function BaseConfigForm() {
    const { t } = useTranslation();
    const config = useConfigStore((state) => state.config);
    const updateMetadata = useConfigStore((state) => state.updateMetadata);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<BaseConfigFormData>({
        defaultValues: {
            name: config.metadata.name,
            lang: (config.metadata.lang as "auto" | "en" | "fr") || "auto",
            currency:
                (config.metadata.currency as "eur" | "usd" | "gbp") || "eur",
            logoUrl: config.metadata.logoUrl || "",
            homepageLink: config.metadata.homepageLink || "",
        },
    });

    const onSubmit = (data: BaseConfigFormData) => {
        updateMetadata({
            name: data.name,
            lang: data.lang,
            currency: data.currency,
            logoUrl: data.logoUrl || undefined,
            homepageLink: data.homepageLink || undefined,
        });
        toast.success("Base settings saved");
    };

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
                <div className={styles.formField}>
                    <label htmlFor="name" className={styles.label}>
                        {t("configuration.baseForm.name")}
                    </label>
                    <Input
                        id="name"
                        type="text"
                        length="big"
                        placeholder={t(
                            "configuration.baseForm.namePlaceholder"
                        )}
                        {...register("name", {
                            required: "configuration.baseForm.nameRequired",
                            maxLength: {
                                value: 100,
                                message:
                                    "Application name must be less than 100 characters",
                            },
                        })}
                    />
                    {errors.name && (
                        <span className={styles.error}>
                            {t(errors.name.message || "")}
                        </span>
                    )}
                    <p className={styles.description}>
                        App Name is <strong>required</strong> and will be used
                        as the title of the app.
                    </p>
                </div>

                <div className={styles.formField}>
                    <label htmlFor="lang" className={styles.label}>
                        {t("configuration.baseForm.language")}
                    </label>
                    <Select
                        value={watch("lang")}
                        onValueChange={(value) =>
                            setValue("lang", value as "auto" | "en" | "fr")
                        }
                    >
                        <SelectTrigger length="big">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {languages.map((language) => (
                                <SelectItem
                                    key={language.value}
                                    value={language.value}
                                >
                                    {language.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className={styles.description}>
                        Language of the app (<strong>optional</strong>). It will
                        be used to display the app in the correct language. By
                        default, the language will be the language of the
                        browser.
                    </p>
                </div>

                <div className={styles.formField}>
                    <label htmlFor="currency" className={styles.label}>
                        {t("configuration.baseForm.currency")}
                    </label>
                    <Select
                        value={watch("currency")}
                        onValueChange={(value) =>
                            setValue("currency", value as "eur" | "usd" | "gbp")
                        }
                    >
                        <SelectTrigger length="big">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {currencies.map((currency) => (
                                <SelectItem
                                    key={currency.value}
                                    value={currency.value}
                                >
                                    {currency.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className={styles.description}>
                        Currency of the app (<strong>optional</strong>). It will
                        be used to display the app in the correct currency. By
                        default, the currency will be in Euro.
                    </p>
                </div>

                <div className={styles.formField}>
                    <label htmlFor="logoUrl" className={styles.label}>
                        {t("configuration.baseForm.logoUrl")}
                    </label>
                    <Input
                        id="logoUrl"
                        type="url"
                        length="big"
                        placeholder={t(
                            "configuration.baseForm.logoUrlPlaceholder"
                        )}
                        {...register("logoUrl", {
                            pattern: {
                                value: /^https?:\/\/.+/,
                                message:
                                    "configuration.baseForm.logoUrlInvalid",
                            },
                        })}
                    />
                    {errors.logoUrl && (
                        <span className={styles.error}>
                            {t(errors.logoUrl.message || "")}
                        </span>
                    )}
                    <p className={styles.description}>
                        URL of your logo (<strong>optional</strong>). It will be
                        used on modal and sso popup.
                    </p>
                </div>

                <div className={styles.formField}>
                    <label htmlFor="homepageLink" className={styles.label}>
                        {t("configuration.baseForm.homepageLink")}
                    </label>
                    <Input
                        id="homepageLink"
                        type="url"
                        length="big"
                        placeholder={t(
                            "configuration.baseForm.homepageLinkPlaceholder"
                        )}
                        {...register("homepageLink", {
                            pattern: {
                                value: /^https?:\/\/.+/,
                                message:
                                    "configuration.baseForm.homepageLinkInvalid",
                            },
                        })}
                    />
                    {errors.homepageLink && (
                        <span className={styles.error}>
                            {t(errors.homepageLink.message || "")}
                        </span>
                    )}
                    <p className={styles.description}>
                        URL of your homepage website (<strong>optional</strong>
                        ). It will be used as a link on logo.
                    </p>
                </div>

                <button type="submit" className={styles.submitButton}>
                    Submit
                </button>
            </form>
        </div>
    );
}
