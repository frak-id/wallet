import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { PencilIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Confirm dismissal — caller should close the parent edit sheet. */
    onConfirm: () => void;
};

/**
 * Confirmation modal shown when the user tries to dismiss the edit sheet
 * (X or "Annuler"). Sits on top of the sheet via the standard
 * `ResponsiveModal` portal, so the sheet stays mounted underneath.
 */
export function EditReferralCancelModal({
    open,
    onOpenChange,
    onConfirm,
}: Props) {
    const { t } = useTranslation();

    const title = t("wallet.referral.edit.cancelConfirm.title");
    const description = t("wallet.referral.edit.cancelConfirm.description");

    const handleClose = () => onOpenChange(false);

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={handleClose}
                />
            }
        >
            <Box className={styles.body}>
                <Box className={styles.content}>
                    <IconCircle>
                        <PencilIcon
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
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onConfirm}
                    >
                        {t("wallet.referral.edit.cancelConfirm.confirmCta")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={handleClose}
                    >
                        {t("wallet.referral.edit.cancelConfirm.continueCta")}
                    </Button>
                </Box>
            </Box>
        </ResponsiveModal>
    );
}
