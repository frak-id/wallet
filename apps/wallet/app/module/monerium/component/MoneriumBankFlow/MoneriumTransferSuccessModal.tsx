import { Box } from "@frak-labs/design-system/components/Box";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { Text } from "@frak-labs/design-system/components/Text";
import { CircleCheckIcon } from "@frak-labs/design-system/icons";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./MoneriumTransferSuccessModal.css";

const AUTO_DISMISS_MS = 5_000;

type MoneriumTransferSuccessModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    amount: string;
};

export function MoneriumTransferSuccessModal({
    open,
    onOpenChange,
    amount,
}: MoneriumTransferSuccessModalProps) {
    const { t } = useTranslation();

    // Auto-dismiss; cleanup cancels the timer if the modal closes early so
    // we don't fire a stale `onOpenChange(false)` after re-open.
    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(
            () => onOpenChange(false),
            AUTO_DISMISS_MS
        );
        return () => window.clearTimeout(timer);
    }, [open, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={styles.successDialog}>
                <Box
                    display={"flex"}
                    flexDirection={"column"}
                    alignItems={"center"}
                    gap={"l"}
                >
                    <Box color={"action"} display={"flex"}>
                        <CircleCheckIcon />
                    </Box>
                    <DialogTitle className={styles.successTitle}>
                        {/* `as="span"` avoids `<h2><h2/></h2>` nesting. */}
                        <Text variant="heading2" align="center" as="span">
                            {t("monerium.bankFlow.transfer.success.title", {
                                amount,
                            })}
                        </Text>
                    </DialogTitle>
                </Box>
                <DialogDescription className={styles.successDescription}>
                    {/* `as="span"` avoids `<p><p/></p>` nesting. */}
                    <Text
                        variant="bodySmall"
                        weight="medium"
                        color="secondary"
                        align="center"
                        as="span"
                    >
                        {t("monerium.bankFlow.transfer.success.description")}
                    </Text>
                </DialogDescription>
            </DialogContent>
        </Dialog>
    );
}
