import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import type { PreviousAuthenticatorModel } from "@frak-labs/wallet-shared";
import { useLogin } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

/**
 * The register component
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

    if (isPrimary) {
        return (
            <Box className={styles.sso__primaryButtonWrapper}>
                <Button
                    onClick={() => {
                        // Reset the error
                        onError(null);

                        login({ lastAuthentication, merchantId });
                    }}
                    disabled={isLoading}
                >
                    <Text as="span" variant="bodySmall">
                        {t("authent.sso.btn.existing.login")}
                    </Text>
                </Button>
            </Box>
        );
    }

    return (
        <Box className={styles.sso__secondaryButtonWrapper}>
            <Box
                as="button"
                className={styles.sso__buttonLink}
                disabled={isLoading}
                onClick={() => {
                    // Reset the error
                    onError(null);

                    login({ lastAuthentication, merchantId });
                }}
                type={"button"}
            >
                {t("authent.sso.btn.new.login")}
            </Box>
        </Box>
    );
}
