import { Box } from "@frak-labs/design-system/components/Box";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { Text } from "@frak-labs/design-system/components/Text";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./MoneriumTransferSuccessModal.css";

const AUTO_DISMISS_MS = 5_000;

type MoneriumTransferSuccessModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    amount: string;
};

function SuccessOutlineIcon() {
    return (
        <svg
            width="104"
            height="104"
            viewBox="0 0 104 104"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M32.0607 56.182C31.4749 55.5962 31.4749 54.6464 32.0607 54.0606C32.6464 53.4749 33.5962 53.4749 34.182 54.0606L44.4599 64.3386L69.7478 39.0508C70.3336 38.465 71.2833 38.465 71.8691 39.0508C72.4549 39.6365 72.4549 40.5863 71.8691 41.1721L45.7062 67.335C45.5732 67.468 45.4214 67.5709 45.2593 67.6435C44.6749 68.0472 43.8676 67.9889 43.3474 67.4687L32.0607 56.182Z"
                fill="currentColor"
            />
            <path
                d="M52 100C25.4903 100 4 78.5097 4 52C4 25.4903 25.4903 4 52 4C78.5097 4 100 25.4903 100 52C100 78.5097 78.5097 100 52 100ZM52 97C76.8528 97 97 76.8528 97 52C97 27.1472 76.8528 7 52 7C27.1472 7 7 27.1472 7 52C7 76.8528 27.1472 97 52 97Z"
                fill="currentColor"
            />
        </svg>
    );
}

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
                        <SuccessOutlineIcon />
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
