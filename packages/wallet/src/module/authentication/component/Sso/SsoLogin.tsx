import { useLogin } from "@/module/authentication/hook/useLogin";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * The register component
 * @constructor
 */
export function SsoLoginComponent({ onSuccess }: { onSuccess: () => void }) {
    const { t } = useTranslation();
    const { login } = useLogin({
        onSuccess: () => onSuccess(),
    });

    return (
        <p className={styles.sso__buttonLoginWrapper}>
            <button
                className={styles.sso__buttonLink}
                onClick={() => login({})}
                type={"button"}
            >
                {t("authent.sso.btn.login")}
            </button>
        </p>
    );
}
