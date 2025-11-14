import styles from "./Preview.module.css";

type DismissFormData = {
    primaryAction?: string;
};

type DismissPreviewProps = {
    formData: DismissFormData;
    lang: "en" | "fr";
};

const dismissDefaults = {
    en: {
        primaryAction: "Continue browsing",
    },
    fr: {
        primaryAction: "Je continue ma navigation",
    },
} as const;

export function DismissPreview({ formData, lang }: DismissPreviewProps) {
    const defaults = dismissDefaults[lang];
    const primaryAction =
        formData.primaryAction && formData.primaryAction.trim().length > 0
            ? formData.primaryAction
            : defaults.primaryAction;

    return (
        <div>
            <div className={styles.preview}>
                <p className={styles.dismissButtonContainer}>
                    <button type="button" className={styles.dismissButton}>
                        {primaryAction}
                    </button>
                </p>
            </div>
        </div>
    );
}
