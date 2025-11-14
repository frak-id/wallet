import { useTranslation } from "react-i18next";
import { ButtonSharePreview } from "./ButtonSharePreview";
import { ButtonWalletPreview } from "./ButtonWalletPreview";
import { ComponentCard } from "./ComponentCard";
import styles from "./ComponentList.module.css";

export function ComponentList() {
    const { t } = useTranslation();

    const embedOptions = [
        {
            title: t("components.shareButton.title"),
            description: t("components.shareButton.description"),
            action: t("components.shareButton.action"),
            preview: ButtonSharePreview,
            showWallet: false,
        },
        {
            title: t("components.walletButton.title"),
            description: t("components.walletButton.description"),
            action: t("components.walletButton.action"),
            preview: ButtonWalletPreview,
            showWallet: true,
        },
    ];

    return (
        <>
            <div className={styles.header}>
                <div className={styles.embedOptionsLabel}>
                    {t("common.embedOptions")}
                </div>
                <h2>{t("common.h2")}</h2>
            </div>

            <div className={styles.listComponents}>
                {embedOptions.map((option) => (
                    <ComponentCard key={option.title} {...option} />
                ))}
            </div>
        </>
    );
}
