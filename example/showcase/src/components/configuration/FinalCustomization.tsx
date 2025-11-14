import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { getLanguageLabel } from "@/utils/languages";
import styles from "./CustomizationSubForm.module.css";
import { FinalPreview } from "./FinalPreview";

type FinalFormData = {
    description?: string;
    dismissed?: {
        description?: string;
    };
};

type FinalCustomizationProps = {
    lang: "en" | "fr";
};

export function FinalCustomization({ lang }: FinalCustomizationProps) {
    const config = useConfigStore((state) => state.config);
    const updateI18n = useConfigStore((state) => state.updateI18n);

    const langData = config.customizations.i18n[lang] || {};

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<FinalFormData>({
        defaultValues: {
            description: langData["sdk.modal.final.description"] || "",
            dismissed: {
                description:
                    langData["sdk.modal.final.dismissed.description"] || "",
            },
        },
    });

    const formData = watch();

    const onSubmit = (data: FinalFormData) => {
        updateI18n(lang, {
            "sdk.modal.final.description": data.description ?? "",
            "sdk.modal.final.dismissed.description":
                data.dismissed?.description ?? "",
        });
        toast.success(
            `Final screen customization saved for ${getLanguageLabel(lang)}`
        );
    };

    return (
        <div className={styles.container}>
            <FinalPreview formData={formData} lang={lang} />

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
                <div className={styles.formField}>
                    <label
                        htmlFor={`description-${lang}`}
                        className={styles.label}
                    >
                        Description
                    </label>
                    <input
                        id={`description-${lang}`}
                        type="text"
                        className={styles.input}
                        placeholder="You're all set! Your wallet is ready to use."
                        {...register("description")}
                    />
                    {errors.description && (
                        <span className={styles.error}>
                            {errors.description.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Description of the final screen (
                        <strong>optional</strong>
                        ).
                    </p>
                </div>

                <div className={styles.formField}>
                    <label
                        htmlFor={`dismissed-description-${lang}`}
                        className={styles.label}
                    >
                        Dismissed description
                    </label>
                    <input
                        id={`dismissed-description-${lang}`}
                        type="text"
                        className={styles.input}
                        placeholder="You can reactivate your wallet anytime"
                        {...register("dismissed.description")}
                    />
                    {errors.dismissed?.description && (
                        <span className={styles.error}>
                            {errors.dismissed.description.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Description of the dismissed screen (
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
