import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { getLanguageLabel } from "@/utils/languages";
import styles from "./CustomizationSubForm.module.css";
import { DismissPreview } from "./DismissPreview";

type DismissFormData = {
    primaryAction?: string;
};

type DismissCustomizationProps = {
    lang: "en" | "fr";
};

export function DismissCustomization({ lang }: DismissCustomizationProps) {
    const config = useConfigStore((state) => state.config);
    const updateI18n = useConfigStore((state) => state.updateI18n);

    const langData = config.customizations.i18n[lang] || {};

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<DismissFormData>({
        defaultValues: {
            primaryAction: langData["sdk.modal.dismiss.primaryAction"] || "",
        },
    });

    const formData = watch();

    const onSubmit = (data: DismissFormData) => {
        updateI18n(lang, {
            "sdk.modal.dismiss.primaryAction": data.primaryAction ?? "",
        });
        toast.success(
            `Dismiss modal customization saved for ${getLanguageLabel(lang)}`
        );
    };

    return (
        <div className={styles.container}>
            <DismissPreview formData={formData} lang={lang} />

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
                <div className={styles.formField}>
                    <label
                        htmlFor={`primaryAction-${lang}`}
                        className={styles.label}
                    >
                        Primary action
                    </label>
                    <input
                        id={`primaryAction-${lang}`}
                        type="text"
                        className={styles.input}
                        placeholder="Close"
                        {...register("primaryAction")}
                    />
                    {errors.primaryAction && (
                        <span className={styles.error}>
                            {errors.primaryAction.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Primary action of the dismiss screen (
                        <strong>optional</strong>).
                    </p>
                </div>

                <button type="submit" className={styles.submitButton}>
                    Submit
                </button>
            </form>
        </div>
    );
}
