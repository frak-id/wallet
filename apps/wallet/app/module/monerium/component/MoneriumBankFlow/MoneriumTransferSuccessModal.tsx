import { Box } from "@frak-labs/design-system/components/Box";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";

type MoneriumTransferSuccessModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    amount: string;
};

/**
 * Overlay modal shown when a Monerium offramp order has been successfully
 * placed. Portals through Radix Dialog so it sits on top of the flow
 * DetailSheet.
 */
export function MoneriumTransferSuccessModal({
    open,
    onOpenChange,
    amount,
}: MoneriumTransferSuccessModalProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <Stack space="m" align="center">
                    <Box color="success" display="flex" alignItems="center">
                        <CircleCheckIcon width={56} height={56} />
                    </Box>
                    <DialogTitle>
                        {t("monerium.bankFlow.transfer.success.title", {
                            amount,
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("monerium.bankFlow.transfer.success.description")}
                    </DialogDescription>
                </Stack>
            </DialogContent>
        </Dialog>
    );
}
