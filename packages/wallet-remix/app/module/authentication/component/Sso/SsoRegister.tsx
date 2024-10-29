import { ssoContextAtom } from "@/module/authentication/atoms/sso";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Notice } from "@/module/common/component/Notice";
import { Fingerprint } from "@module/asset/icons/Fingerprint";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useAtomValue } from "jotai/index";
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
}: { isPrimary: boolean; onSuccess: () => void }) {
    const { t } = useTranslation();
    const ssoId = useAtomValue(ssoContextAtom)?.id;
    const { register, error, isRegisterInProgress } = useRegister({
        ssoId,
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

    if (isPrimary) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <AuthFingerprint
                    icon={<Fingerprint color={"#000"} sizes={57} />}
                    isShiny={false}
                    action={register}
                    disabled={
                        isRegisterInProgress ||
                        isPreviouslyUsedAuthenticatorError
                    }
                    className={styles.sso__buttonPrimary}
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
                onClick={() => register()}
                type={"button"}
            >
                {t("authent.sso.btn.existing.create")}
            </button>
            {statusComponent}
        </p>
    );
}
