import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";

type ReferralConfirmModalProps = {
    open: boolean;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    /** A `\n` in the translated title is kept as a line break. */
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    confirmVariant?: "primary" | "destructive";
    onConfirm: () => void;
    /** Every way out short of confirming: cancel, close, swipe or backdrop. */
    onCancel: () => void;
    /** Locks every way out while the confirmed action runs. */
    isPending?: boolean;
    errorMessage?: string | null;
};

/** A referral decision the user confirms or backs out of, on the standard `ResponsiveModal`. */
export function ReferralConfirmModal({
    open,
    icon: Icon,
    title,
    description,
    confirmLabel,
    cancelLabel,
    confirmVariant = "primary",
    onConfirm,
    onCancel,
    isPending = false,
    errorMessage,
}: ReferralConfirmModalProps) {
    const { t } = useTranslation();

    const cancel = () => {
        if (!isPending) onCancel();
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={(next) => {
                if (!next) cancel();
            }}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={cancel}
                    disabled={isPending}
                />
            }
        >
            <Box className={styles.body}>
                <Box className={styles.content}>
                    <IconCircle>
                        <Icon width={24} height={24} color={vars.text.action} />
                    </IconCircle>
                    <Box className={styles.text}>
                        <Text as="h2" variant="heading2" weight="semiBold">
                            {title}
                        </Text>
                        <Text as="p" variant="body" color="secondary">
                            {description}
                        </Text>
                    </Box>
                </Box>
                <Box className={styles.actions}>
                    {errorMessage ? (
                        <Text variant="caption" color="error" align="center">
                            {errorMessage}
                        </Text>
                    ) : null}
                    <Button
                        type="button"
                        variant={confirmVariant}
                        size="large"
                        width="full"
                        loading={isPending}
                        disabled={isPending}
                        onClick={onConfirm}
                    >
                        {isPending ? null : confirmLabel}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        disabled={isPending}
                        onClick={cancel}
                    >
                        {cancelLabel}
                    </Button>
                </Box>
            </Box>
        </ResponsiveModal>
    );
}
