import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import type { PreviousAuthenticatorModel } from "@frak-labs/wallet-shared";
import { useLogin } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";

/**
 * The login component
 * @constructor
 */
export function SsoLoginComponent({
    isPrimary,
    onSuccess,
    onError,
    merchantId,
    lastAuthentication,
}: {
    isPrimary: boolean;
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    merchantId?: string;
    lastAuthentication?: PreviousAuthenticatorModel;
}) {
    const { t } = useTranslation();
    const { login, isLoading } = useLogin({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });

    const label = isPrimary
        ? t("authent.sso.btn.existing.login")
        : t("authent.sso.btn.new.login");

    return (
        <Box>
            <Button
                variant={isPrimary ? "primary" : "secondary"}
                icon={
                    isPrimary ? (
                        <FaceIdIcon width={24} height={24} />
                    ) : undefined
                }
                loading={isLoading}
                onClick={() => {
                    // Reset the error
                    onError(null);

                    login({ lastAuthentication, merchantId });
                }}
            >
                {label}
            </Button>
        </Box>
    );
}
