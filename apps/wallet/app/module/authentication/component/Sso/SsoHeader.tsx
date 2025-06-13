import { LogoFrak } from "@frak-labs/ui/icons/LogoFrak";
import { useTranslation } from "react-i18next";
import styles from "./SsoHeader.module.css";

export function SsoHeader() {
    const { t } = useTranslation();
    return (
        <header className={styles.ssoHeader}>
            <LogoFrak sizes={14} />
            <h1 className={styles.ssoHeader__title}>
                {t("authent.sso.header.title")}
            </h1>
        </header>
    );
}
