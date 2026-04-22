import { Box } from "@frak-labs/design-system/components/Box";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

type RecoveryCodeSuccessModalProps = {
    onClose: () => void;
    merchant?: { name: string; domain: string };
};

export function RecoveryCodeSuccessModal({
    onClose,
    merchant,
}: RecoveryCodeSuccessModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleClose = useCallback(() => {
        onClose();
        // Navigate back to register to continue the onboarding
        navigate({ to: "/register", replace: true });
    }, [onClose, navigate]);

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) handleClose();
            }}
            title={t("recoveryCode.success.title")}
            description={t("recoveryCode.success.description")}
        >
            <Box
                display={"flex"}
                flexDirection={"column"}
                alignItems={"center"}
                gap={"m"}
                textAlign={"center"}
            >
                <CircleCheckIcon className={styles.successIcon} />
                <Text variant="heading2" weight="semiBold">
                    {t("recoveryCode.success.title")}
                </Text>
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {t("recoveryCode.success.description")}
                </Text>
                {merchant && (
                    <Text variant="bodySmall" weight="semiBold">
                        {t("recoveryCode.success.merchantInfo", {
                            merchantName: merchant.name,
                        })}
                    </Text>
                )}
            </Box>
        </ResponsiveModal>
    );
}
