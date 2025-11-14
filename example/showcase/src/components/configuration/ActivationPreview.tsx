import styles from "./Preview.module.css";

type ActivationFormData = {
    description?: string;
    primaryAction?: string;
};

type ActivationPreviewProps = {
    formData: ActivationFormData;
    lang: "en" | "fr";
};

const activationDefaults = {
    en: {
        description: "Connect to your account with **{{ productName }}**",
        primaryAction: "Create my wallet",
    },
    fr: {
        description: "Connectez-vous à votre compte avec **{{ productName }}**",
        primaryAction: "Créer mon porte-monnaie",
    },
} as const;

export function ActivationPreview({ formData, lang }: ActivationPreviewProps) {
    const defaults = activationDefaults[lang];
    const description =
        formData.description && formData.description.trim().length > 0
            ? formData.description
            : defaults.description;
    const primaryAction =
        formData.primaryAction && formData.primaryAction.trim().length > 0
            ? formData.primaryAction
            : defaults.primaryAction;

    return (
        <div>
            <div className={styles.preview}>
                <p className={styles.description}>{description}</p>
                <p className={styles.buttonContainer}>
                    <button type="button" className={styles.primaryButton}>
                        {primaryAction}
                    </button>
                </p>
            </div>
        </div>
    );
}
