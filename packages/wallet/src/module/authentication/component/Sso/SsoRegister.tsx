import { useRegister } from "@/module/authentication/hook/useRegister";
import { Notice } from "@/module/common/component/Notice";
import { Fingerprint } from "@module/asset/icons/Fingerprint";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * The register component
 * @constructor
 */
export function SsoRegisterComponent({ onSuccess }: { onSuccess: () => void }) {
    const { t } = useTranslation();
    const { register, error, isRegisterInProgress } = useRegister({
        onSuccess: () => onSuccess(),
    });

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () =>
            !!error &&
            "code" in error &&
            error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
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

    return (
        <p className={styles.sso__buttonRegisterWrapper}>
            <AuthFingerprint
                icon={<Fingerprint color={"#000"} sizes={57} />}
                isShiny={false}
                action={register}
                disabled={isPreviouslyUsedAuthenticatorError}
                className={styles.sso__buttonRegister}
            >
                {t("authent.sso.btn.create")}
            </AuthFingerprint>
            {statusComponent}
        </p>
    );
}
