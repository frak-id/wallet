import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { WarningIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";

type Props = {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    isPending?: boolean;
};

/** Warns that a friend's code replacing Frak as referrer ends the exclusive cashback. */
export function ReplaceFrakReferrerModal({
    open,
    onConfirm,
    onCancel,
    isPending = false,
}: Props) {
    const { t } = useTranslation();

    const title = t("wallet.referral.redeem.replaceFrak.title");
    const description = t("wallet.referral.redeem.replaceFrak.description");

    const handleCancel = () => {
        if (!isPending) onCancel();
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={(next) => {
                if (!next) handleCancel();
            }}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={handleCancel}
                    disabled={isPending}
                />
            }
        >
            <Box className={styles.body}>
                <Box className={styles.content}>
                    <IconCircle>
                        <WarningIcon
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
                        <Text as="p" variant="body" color="secondary">
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
                        loading={isPending}
                        disabled={isPending}
                        onClick={onConfirm}
                    >
                        {isPending
                            ? null
                            : t(
                                  "wallet.referral.redeem.replaceFrak.confirmCta"
                              )}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        disabled={isPending}
                        onClick={handleCancel}
                    >
                        {t("wallet.referral.redeem.replaceFrak.cancelCta")}
                    </Button>
                </Box>
            </Box>
        </ResponsiveModal>
    );
}
