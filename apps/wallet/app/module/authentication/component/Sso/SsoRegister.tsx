import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { isUserCancellation } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { isAuthenticatorAlreadyRegistered } from "@/module/authentication/lib/isAuthenticatorAlreadyRegistered";
import { Notice } from "@/module/common/component/Notice";
import * as styles from "./index.css";

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

    const isPreviouslyUsedAuthenticatorError = useMemo(
        () => !!error && isAuthenticatorAlreadyRegistered(error),
        [error]
    );

    const isCancelledError = useMemo(
        () => !!error && isUserCancellation(error),
        [error]
    );

    const statusComponent = useMemo(() => {
        if (isPreviouslyUsedAuthenticatorError) {
            return <Notice>{t("authent.create.inProgress")}</Notice>;
        }
        if (isRegisterInProgress) {
            return <Notice>{t("authent.create.inProgress")}</Notice>;
        }
        if (error && !isCancelledError) {
            return <Notice>{t("authent.create.error")}</Notice>;
        }

        return null;
    }, [
        isPreviouslyUsedAuthenticatorError,
        isCancelledError,
        error,
        isRegisterInProgress,
        t,
    ]);

    if (isPrimary) {
        return (
            <Box className={styles.sso__primaryButtonWrapper}>
                <Button
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
                    <Text as="span" variant="bodySmall">
                        {t("authent.sso.btn.new.create")}
                    </Text>
                </Button>
                {statusComponent}
            </Box>
        );
    }

    return (
        <Box className={styles.sso__secondaryButtonWrapper}>
            <Box
                as="button"
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
            </Box>
            {statusComponent}
        </Box>
    );
}
