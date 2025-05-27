import { ssoContextAtom } from "@/module/authentication/atoms/sso";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Notice } from "@/module/common/component/Notice";
import { trackEvent } from "@/module/common/utils/trackEvent";
import { Fingerprint } from "@shared/module/asset/icons/Fingerprint";
import { AuthFingerprint } from "@shared/module/component/AuthFingerprint";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

/**
 * The register component
 * @constructor
 */
export function SsoRegisterComponent({
    isPrimary,
    onSuccess,
    onError,
}: {
    isPrimary: boolean;
    onSuccess: () => void;
    onError: (error: Error | null) => void;
}) {
    const { t } = useTranslation();
    const ssoId = useAtomValue(ssoContextAtom)?.id;
    const { register, error, isRegisterInProgress } = useRegister({
        ssoId,
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
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

    if (isPrimary) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <AuthFingerprint
                    icon={<Fingerprint color={"#fff"} sizes={39} />}
                    isShiny={false}
                    action={() => {
                        // Reset the error
                        onError(null);

                        register().then(() => {
                            trackEvent("cta-sso-register");
                        });
                    }}
                    disabled={
                        isRegisterInProgress ||
                        isPreviouslyUsedAuthenticatorError
                    }
                    className={styles.sso__buttonPrimary}
                    childrenPosition={"top"}
                >
                    {t("authent.sso.btn.new.create")}
                </AuthFingerprint>
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

                    register().then(() => {
                        trackEvent("cta-sso-register");
                    });
                }}
                type={"button"}
            >
                {t("authent.sso.btn.existing.create")}
            </button>
            {statusComponent}
        </p>
    );
}
