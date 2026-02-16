import { ButtonAuth } from "@frak-labs/ui/component/ButtonAuth";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Notice } from "@/module/common/component/Notice";
import styles from "./index.module.css";

/**
 * The register component
 * @constructor
 */
export function SsoRegisterComponent({
    isPrimary,
    onSuccess,
    onError,
    merchantId,
}: {
    isPrimary: boolean;
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    merchantId?: string;
}) {
    const { t } = useTranslation();
    const { register, error, isRegisterInProgress } = useRegister({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () =>
            !!error &&
            "cause" in error &&
            error.cause instanceof DOMException &&
            error.cause.name === "InvalidStateError",
        [error]
    );

    /**
     * The status component
     */
    const statusComponent = useMemo(() => {
        if (isPreviouslyUsedAuthenticatorError) {
            return <Notice>{t("authent.create.inProgress")}</Notice>;
        }
        if (isRegisterInProgress) {
            return <Notice>{t("authent.create.inProgress")}</Notice>;
        }
        if (error) {
            return <Notice>{t("authent.create.error")}</Notice>;
        }

        return null;
    }, [isPreviouslyUsedAuthenticatorError, error, isRegisterInProgress, t]);

    if (isPrimary) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <ButtonAuth
                    onClick={() => {
                        // Reset the error
                        onError(null);

                        register({ merchantId });
                    }}
                    disabled={
                        isRegisterInProgress ||
                        isPreviouslyUsedAuthenticatorError
                    }
                >
                    {t("authent.sso.btn.new.create")}
                </ButtonAuth>
                {statusComponent}
            </p>
        );
    }

    return (
        <p className={styles.sso__secondaryButtonWrapper}>
            <button
                className={styles.sso__buttonLink}
                disabled={
                    isRegisterInProgress || isPreviouslyUsedAuthenticatorError
                }
                onClick={() => {
                    // Reset the error
                    onError(null);

                    register({ merchantId });
                }}
                type={"button"}
            >
                {t("authent.sso.btn.existing.create")}
            </button>
            {statusComponent}
        </p>
    );
}
