import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { isUserCancellation } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { isAuthenticatorAlreadyRegistered } from "@/module/authentication/lib/isAuthenticatorAlreadyRegistered";
import { Notice } from "@/module/common/component/Notice";

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

    const label = isPrimary
        ? t("authent.sso.btn.new.create")
        : t("authent.sso.btn.existing.create");

    return (
        <Box>
            <Button
                variant={isPrimary ? "primary" : "ghost"}
                disabled={
                    isRegisterInProgress || isPreviouslyUsedAuthenticatorError
                }
                onClick={() => {
                    // Reset the error
                    onError(null);

                    register({ merchantId });
                }}
            >
                {label}
            </Button>
            {statusComponent}
        </Box>
    );
}
