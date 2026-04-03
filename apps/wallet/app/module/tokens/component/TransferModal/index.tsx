import { Box } from "@frak-labs/design-system/components/Box";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import { TransferIcon, WalletIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useNavigate } from "@tanstack/react-router";
import type { SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import * as styles from "./index.css";

type TransferModalProps = {
    onClose: () => void;
};

function BankIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path d="M12.5 3.5L4 8V9.5H21V8L12.5 3.5Z" fill="currentColor" />
            <path d="M5.5 11V17H7.5V11H5.5Z" fill="currentColor" />
            <path d="M9.5 11V17H11.5V11H9.5Z" fill="currentColor" />
            <path d="M13.5 11V17H15.5V11H13.5Z" fill="currentColor" />
            <path d="M17.5 11V17H19.5V11H17.5Z" fill="currentColor" />
            <path d="M4 18.5V20.5H21V18.5H4Z" fill="currentColor" />
        </svg>
    );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M7.5 15L12.5 10L7.5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function TransferModal({ onClose }: TransferModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const title = t("wallet.transferModal.title");
    const description = t("wallet.transferModal.description");

    const handleBankClick = () => {
        // Bank account flow — not yet implemented
    };

    const handleWalletClick = () => {
        onClose();
        navigate({ to: "/tokens/send" });
    };

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={title}
            description={description}
            header={
                <CloseButton
                    ariaLabel={t("common.close")}
                    iconSize={24}
                    variant="inline"
                    onClick={onClose}
                />
            }
        >
            <Box
                display={"flex"}
                flexDirection={"column"}
                gap={"l"}
                paddingBottom={"l"}
            >
                {/* Header: icon + title + description */}
                <Box
                    display={"flex"}
                    flexDirection={"column"}
                    alignItems={"center"}
                    gap={"s"}
                    textAlign={"center"}
                >
                    <IconCircle className={styles.actionIconColor}>
                        <TransferIcon width={24} height={24} />
                    </IconCircle>
                    <Text variant="heading3">{title}</Text>
                    <Text variant="bodySmall" color="secondary">
                        {description}
                    </Text>
                </Box>

                {/* Option rows */}
                <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                    <Box
                        as="button"
                        type="button"
                        className={styles.optionRow}
                        display={"flex"}
                        alignItems={"center"}
                        gap={"m"}
                        padding={"s"}
                        cursor={"pointer"}
                        textAlign={"left"}
                        borderRadius={"m"}
                        onClick={handleBankClick}
                    >
                        <Box className={styles.rowIconCircle}>
                            <BankIcon width={18} height={18} />
                        </Box>
                        <Box
                            display={"flex"}
                            flexDirection={"column"}
                            flexGrow={1}
                        >
                            <Text variant="bodySmall" weight="bold">
                                {t("wallet.transferModal.bankAccount")}
                            </Text>
                            <Text variant="caption" color="secondary">
                                {t(
                                    "wallet.transferModal.bankAccountDescription"
                                )}
                            </Text>
                        </Box>
                        <ChevronRightIcon color={vars.icon.action} />
                    </Box>

                    <Box
                        as="button"
                        type="button"
                        className={styles.optionRow}
                        display={"flex"}
                        alignItems={"center"}
                        gap={"m"}
                        padding={"s"}
                        cursor={"pointer"}
                        textAlign={"left"}
                        borderRadius={"m"}
                        onClick={handleWalletClick}
                    >
                        <Box className={styles.rowIconCircle}>
                            <WalletIcon width={18} height={18} />
                        </Box>
                        <Box
                            display={"flex"}
                            flexDirection={"column"}
                            flexGrow={1}
                        >
                            <Text variant="bodySmall" weight="bold">
                                {t("wallet.transferModal.wallet")}
                            </Text>
                            <Text variant="caption" color="secondary">
                                {t("wallet.transferModal.walletDescription")}
                            </Text>
                        </Box>
                        <ChevronRightIcon color={vars.icon.action} />
                    </Box>
                </Box>
            </Box>
        </ResponsiveModal>
    );
}
