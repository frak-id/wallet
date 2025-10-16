import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { useTranslation } from "react-i18next";
import { useLogin } from "@/authentication/hook/useLogin";
import type { PreviousAuthenticatorModel } from "@/common/storage/dexie/PreviousAuthenticatorModel";
import styles from "./index.module.css";

/**
 * The register component
 * @constructor
 */
export function SsoLoginComponent({
    isPrimary,
    onSuccess,
    onError,
    lastAuthentication,
}: {
    isPrimary: boolean;
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    lastAuthentication?: PreviousAuthenticatorModel;
}) {
    const { t } = useTranslation();
    const { login, isLoading } = useLogin({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });

    if (isPrimary) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <ButtonAuth
                    onClick={() => {
                        // Reset the error
                        onError(null);

                        login({ lastAuthentication });
                    }}
                    disabled={isLoading}
                >
                    {t("authent.sso.btn.existing.login")}
                </ButtonAuth>
            </p>
        );
    }

    return (
        <p className={styles.sso__secondaryButtonWrapper}>
            <button
                className={styles.sso__buttonLink}
                disabled={isLoading}
                onClick={() => {
                    // Reset the error
                    onError(null);

                    login({ lastAuthentication });
                }}
                type={"button"}
            >
                {t("authent.sso.btn.new.login")}
            </button>
        </p>
    );
}
