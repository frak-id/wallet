import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { BinIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isPending?: boolean;
    /**
     * i18n key for an error message to surface above the buttons. The
     * caller resolves the key from the mutation error so the modal stays
     * presentational.
     */
    errorMessageKey?: string | null;
};

/**
 * Confirmation modal shown before unredeeming an active referral code.
 * Built on the standard `ResponsiveModal` so it matches the rest of the
 * wallet's modal UX (centered Dialog on tablet+, bottom Drawer on mobile).
 */
export function DeleteRedemptionConfirmModal({
    open,
    onOpenChange,
    onConfirm,
    isPending = false,
    errorMessageKey,
}: Props) {
    const { t } = useTranslation();

    const title = t("wallet.referral.redeem.confirmDelete.title");
    const description = t("wallet.referral.redeem.confirmDelete.description");

    const handleClose = () => {
        if (isPending) return;
        onOpenChange(false);
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={(next) => {
                if (isPending) return;
                onOpenChange(next);
            }}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={handleClose}
                    disabled={isPending}
                />
            }
        >
            <Box className={styles.body}>
                <Box className={styles.content}>
                    <IconCircle>
                        <BinIcon
                            width={24}
                            height={24}
                            color={vars.text.action}
                        />
                    </IconCircle>
                    <Box className={styles.text}>
                        <Text
                            as="h2"
                            variant="heading2"
                            weight="semiBold"
                            className={styles.title}
                        >
                            {title}
                        </Text>
                        <Text
                            as="p"
                            variant="body"
                            color="secondary"
                            className={styles.description}
                        >
                            {description}
                        </Text>
                    </Box>
                </Box>
                <Box className={styles.actions}>
                    {errorMessageKey ? (
                        <Text variant="caption" color="error" align="center">
                            {t(errorMessageKey)}
                        </Text>
                    ) : null}
                    <Button
                        type="button"
                        variant="destructive"
                        size="large"
                        width="full"
                        loading={isPending}
                        disabled={isPending}
                        onClick={onConfirm}
                    >
                        {isPending
                            ? null
                            : t(
                                  "wallet.referral.redeem.confirmDelete.confirmCta"
                              )}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        disabled={isPending}
                        onClick={handleClose}
                    >
                        {t("wallet.referral.redeem.confirmDelete.cancelCta")}
                    </Button>
                </Box>
            </Box>
        </ResponsiveModal>
    );
}
