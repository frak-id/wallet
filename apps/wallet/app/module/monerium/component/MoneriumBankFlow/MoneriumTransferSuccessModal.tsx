import { Box } from "@frak-labs/design-system/components/Box";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const AUTO_DISMISS_MS = 5_000;

type MoneriumTransferSuccessModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Already formatted for display. */
    amount: string;
};

export function MoneriumTransferSuccessModal({
    open,
    onOpenChange,
    amount,
}: MoneriumTransferSuccessModalProps) {
    const { t } = useTranslation();
    const title = t("monerium.bankFlow.transfer.success.title", { amount });
    const description = t("monerium.bankFlow.transfer.success.description");

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(
            () => onOpenChange(false),
            AUTO_DISMISS_MS
        );
        return () => window.clearTimeout(timer);
    }, [open, onOpenChange]);

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
        >
            <Box
                display={"flex"}
                flexDirection={"column"}
                alignItems={"center"}
                gap={"m"}
                textAlign={"center"}
            >
                <Box color={"action"} display={"flex"}>
                    <CircleCheckIcon />
                </Box>
                <Text variant="heading2" weight="semiBold">
                    {title}
                </Text>
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {description}
                </Text>
            </Box>
        </ResponsiveModal>
    );
}
