import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Fingerprint } from "@module/asset/icons/Fingerprint";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useTranslation } from "react-i18next";
import type { Hex } from "viem";
import styles from "./index.module.css";

/**
 * The register component
 * @constructor
 */
export function SsoLoginComponent({
    isPrimary,
    onSuccess,
    lastAuthentication,
}: {
    isPrimary: boolean;
    onSuccess: () => void;
    lastAuthentication?: PreviousAuthenticatorModel;
}) {
    const { t } = useTranslation();
    const { login, isLoading } = useLogin({
        onSuccess: () => onSuccess(),
    });

    if (isPrimary) {
        return (
            <p className={styles.sso__primaryButtonWrapper}>
                <AuthFingerprint
                    icon={<Fingerprint color={"#000"} sizes={57} />}
                    isShiny={false}
                    action={() => login({ lastAuthentication })}
                    disabled={isLoading}
                    className={styles.sso__buttonPrimary}
                >
                    {t("authent.sso.btn.existing.login")}
                </AuthFingerprint>
            </p>
        );
    }

    return (
        <p className={styles.sso__secondaryButtonWrapper}>
            <button
                className={styles.sso__buttonLink}
                disabled={isLoading}
                onClick={() => login({ lastAuthentication })}
                type={"button"}
            >
                {t("authent.sso.btn.new.login")}
            </button>
        </p>
    );
}
