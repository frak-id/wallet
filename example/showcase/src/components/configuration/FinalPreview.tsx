import styles from "./Preview.module.css";
import type { FinalFormData } from "./schemas";

type FinalPreviewProps = {
    formData: FinalFormData;
    lang: "en" | "fr";
};

const finalDefaults = {
    en: {
        description: "You've successfully completed all the steps.",
        dismissedDescription: "All good",
    },
    fr: {
        description: "Vous avez effectué toutes les étapes avec succès.",
        dismissedDescription: "Tout est bon",
    },
} as const;

export function FinalPreview({ formData, lang }: FinalPreviewProps) {
    const defaults = finalDefaults[lang];
    const description =
        formData.description && formData.description.trim().length > 0
            ? formData.description
            : defaults.description;
    const dismissedDescription =
        formData.dismissed?.description &&
        formData.dismissed.description.trim().length > 0
            ? formData.dismissed.description
            : defaults.dismissedDescription;

    return (
        <div>
            <div className={styles.preview}>
                <p className={styles.finalDescription}>{description}</p>
                <p className={styles.dismissButtonContainer}>
                    <button type="button" className={styles.dismissButton}>
                        {dismissedDescription}
                    </button>
                </p>
            </div>
        </div>
    );
}
