import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

type RecoveryCodeSuccessModalProps = {
    onClose: () => void;
    merchant?: { name: string; domain?: string };
    /**
     * Label for an explicit dismiss button. Supplied where this modal is the
     * only way off the page behind it — `ResponsiveModal` draws no close
     * affordance of its own, so without a label the exit is swipe-or-guess.
     */
    actionLabel?: string;
};

export function RecoveryCodeSuccessModal({
    onClose,
    merchant,
    actionLabel,
}: RecoveryCodeSuccessModalProps) {
    const { t } = useTranslation();

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
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
                {actionLabel && (
                    <Button size="large" width="full" onClick={onClose}>
                        {actionLabel}
                    </Button>
                )}
            </Box>
        </ResponsiveModal>
    );
}
