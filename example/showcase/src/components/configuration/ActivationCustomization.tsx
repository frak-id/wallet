import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { getLanguageLabel } from "@/utils/languages";
import { ActivationPreview } from "./ActivationPreview";
import styles from "./CustomizationSubForm.module.css";
import { type ActivationFormData, activationFormSchema } from "./schemas";

type ActivationCustomizationProps = {
    lang: "en" | "fr";
};

export function ActivationCustomization({
    lang,
}: ActivationCustomizationProps) {
    const config = useConfigStore((state) => state.config);
    const updateI18n = useConfigStore((state) => state.updateI18n);

    const langData = config.customizations.i18n[lang] || {};

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<ActivationFormData>({
        resolver: zodResolver(activationFormSchema),
        defaultValues: {
            description: langData["sdk.modal.openSession.description"] || "",
            primaryAction:
                langData["sdk.modal.openSession.primaryAction"] || "",
        },
    });

    const formData = watch();

    const onSubmit = (data: ActivationFormData) => {
        updateI18n(lang, {
            "sdk.modal.openSession.description": data.description ?? "",
            "sdk.modal.openSession.primaryAction": data.primaryAction ?? "",
        });
        toast.success(
            `Activation screen customization saved for ${getLanguageLabel(lang)}`
        );
    };

    return (
        <div className={styles.container}>
            <ActivationPreview formData={formData} lang={lang} />

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
                        placeholder="Activate your wallet to start earning rewards"
                        {...register("description")}
                    />
                    {errors.description && (
                        <span className={styles.error}>
                            {errors.description.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Description of the login screen (
                        <strong>optional</strong>).
                    </p>
                </div>

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
                        placeholder="Activate Wallet"
                        {...register("primaryAction")}
                    />
                    {errors.primaryAction && (
                        <span className={styles.error}>
                            {errors.primaryAction.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Primary action of the login screen (
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
