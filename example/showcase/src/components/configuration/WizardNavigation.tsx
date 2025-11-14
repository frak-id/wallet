import { useTranslation } from "react-i18next";
import { useWizardStore } from "@/stores/wizardStore";
import styles from "./WizardNavigation.module.css";

export function WizardNavigation() {
    const { t } = useTranslation();
    const goToStep = useWizardStore((state) => state.goToStep);

    const steps = [
        { number: 1, label: t("configuration.steps.base") },
        { number: 2, label: t("configuration.steps.customization") },
        { number: 3, label: t("configuration.steps.code") },
    ];

    return (
        <nav className={styles.navigation}>
            <ul className={styles.stepList}>
                {steps.map((step) => (
                    <li key={step.number}>
                        <button
                            type="button"
                            className={styles.stepButton}
                            onClick={() => goToStep(step.number as 1 | 2 | 3)}
                        >
                            {step.number}. {step.label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
