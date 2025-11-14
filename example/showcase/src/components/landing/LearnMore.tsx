import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./LearnMore.module.css";

export function LearnMore() {
    const { t } = useTranslation();

    return (
        <div className={styles.learnMore}>
            <a
                href="https://docs.frak.id/components"
                target="_blank"
                rel="noreferrer"
                className={styles.learnMoreLink}
            >
                {t("common.learnMore")}
                <ArrowRight size={16} />
            </a>
        </div>
    );
}
