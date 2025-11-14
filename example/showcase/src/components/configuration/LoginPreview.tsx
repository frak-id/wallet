import styles from "./Preview.module.css";

type LoginFormData = {
    description?: string;
    primaryAction?: string;
    success?: string;
};

type LoginPreviewProps = {
    formData: LoginFormData;
    lang: "en" | "fr";
};

const loginDefaults = {
    en: {
        description: "Connect to your account with **{{ productName }}**",
        primaryAction: "Create my wallet",
    },
    fr: {
        description: "Connectez-vous à votre compte avec **{{ productName }}**",
        primaryAction: "Créer mon porte-monnaie",
    },
} as const;

export function LoginPreview({ formData, lang }: LoginPreviewProps) {
    const defaults = loginDefaults[lang];
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
