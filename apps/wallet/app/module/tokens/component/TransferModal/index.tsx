import { Box } from "@frak-labs/design-system/components/Box";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ArrowLeftRightIcon,
    BankIcon,
    ChevronRightIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

type TransferModalProps = {
    onClose: () => void;
};

type OptionRowProps = {
    icon: ReactNode;
    title: string;
    description: string;
    onClick: () => void;
};

function OptionRow({ icon, title, description, onClick }: OptionRowProps) {
    return (
        <Box
            as="button"
            type="button"
            className={styles.optionRow}
            display={"flex"}
            alignItems={"center"}
            gap={"m"}
            padding={"s"}
            paddingRight={"none"}
            cursor={"pointer"}
            textAlign={"left"}
            borderRadius={"m"}
            onClick={onClick}
        >
            <Box className={styles.rowIconCircle}>{icon}</Box>
            <Box
                display={"flex"}
                flexDirection={"column"}
                flexGrow={1}
                gap={"xxs"}
            >
                <Text variant="body" weight="medium">
                    {title}
                </Text>
                <Text variant="bodySmall" color="secondary">
                    {description}
                </Text>
            </Box>
            <Box color={"secondary"} display={"flex"}>
                <ChevronRightIcon />
            </Box>
        </Box>
    );
}

export function TransferModal({ onClose }: TransferModalProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const title = t("wallet.transferModal.title");
    const description = t("wallet.transferModal.description");

    const handleBankClick = () => {
        // Close before opening so the picker doesn't sit on the modalStore
        // stack — otherwise it pops back when the bank flow auto-closes.
        onClose();
        modalStore.getState().openModal({ id: "moneriumBankFlow" });
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
            <Box display={"flex"} flexDirection={"column"} gap={"l"}>
                {/* Header: icon disc + title + description */}
                <Box
                    display={"flex"}
                    flexDirection={"column"}
                    alignItems={"center"}
                    gap={"m"}
                    textAlign={"center"}
                >
                    <IconCircle className={styles.actionIconColor}>
                        <ArrowLeftRightIcon width={24} height={24} />
                    </IconCircle>
                    <Text variant="heading2">{title}</Text>
                    <Text variant="body" color="secondary">
                        {description}
                    </Text>
                </Box>

                {/* Option rows */}
                <Box display={"flex"} flexDirection={"column"} gap={"none"}>
                    <OptionRow
                        icon={<BankIcon width={24} height={24} />}
                        title={t("wallet.transferModal.bankAccount")}
                        description={t(
                            "wallet.transferModal.bankAccountDescription"
                        )}
                        onClick={handleBankClick}
                    />
                    <OptionRow
                        icon={<WalletIcon width={24} height={24} />}
                        title={t("wallet.transferModal.wallet")}
                        description={t(
                            "wallet.transferModal.walletDescription"
                        )}
                        onClick={handleWalletClick}
                    />
                </Box>
            </Box>
        </ResponsiveModal>
    );
}
