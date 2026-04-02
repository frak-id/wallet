import { Box } from "@frak-labs/design-system/components/Box";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

export function RecoveryCodeSuccessModal({ onClose }: { onClose: () => void }) {
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
            </Box>
        </ResponsiveModal>
    );
}
