import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useConfigStore } from "@/stores/configStore";
import { getLanguageLabel } from "@/utils/languages";
import styles from "./CustomizationSubForm.module.css";
import { LoginPreview } from "./LoginPreview";
import { type LoginFormData, loginFormSchema } from "./schemas";

type LoginCustomizationProps = {
    lang: "en" | "fr";
};

export function LoginCustomization({ lang }: LoginCustomizationProps) {
    const config = useConfigStore((state) => state.config);
    const updateI18n = useConfigStore((state) => state.updateI18n);

    const langData = config.customizations.i18n[lang] || {};

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginFormSchema),
        defaultValues: {
            description: langData["sdk.modal.login.description"] || "",
            primaryAction: langData["sdk.modal.login.primaryAction"] || "",
            success: langData["sdk.modal.login.successAction"] || "",
        },
    });

    const formData = watch();

    const onSubmit = (data: LoginFormData) => {
        updateI18n(lang, {
            "sdk.modal.login.description": data.description ?? "",
            "sdk.modal.login.primaryAction": data.primaryAction ?? "",
            "sdk.modal.login.successAction": data.success ?? "",
        });
        toast.success(
            `Login screen customization saved for ${getLanguageLabel(lang)}`
        );
    };

    return (
        <div className={styles.container}>
            <LoginPreview formData={formData} lang={lang} />

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
                        placeholder="Connect your wallet to continue"
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
                        placeholder="Connect Wallet"
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

                <div className={styles.formField}>
                    <label htmlFor={`success-${lang}`} className={styles.label}>
                        Success message
                    </label>
                    <input
                        id={`success-${lang}`}
                        type="text"
                        className={styles.input}
                        placeholder="Successfully connected!"
                        {...register("success")}
                    />
                    {errors.success && (
                        <span className={styles.error}>
                            {errors.success.message}
                        </span>
                    )}
                    <p className={styles.description}>
                        Success message of the login screen (
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
