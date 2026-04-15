import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { TransferIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

type EmptyTransferModalProps = {
    onClose: () => void;
};

export function EmptyTransferModal({ onClose }: EmptyTransferModalProps) {
    const { t } = useTranslation();

    const title = t("wallet.transferEmpty.title");
    const description = t("wallet.transferEmpty.description");
    const closeLabel = t("common.close");

    const handleDiscoverClick = () => {
        window.location.assign("/explorer");
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
                    ariaLabel={closeLabel}
                    iconSize={24}
                    variant="inline"
                    onClick={onClose}
                />
            }
        >
            <Box className={styles.emptyTransfer}>
                <ContentBlock
                    icon={
                        <IconCircle>
                            <TransferIcon
                                width={24}
                                height={24}
                                color={vars.text.action}
                            />
                        </IconCircle>
                    }
                    title={title}
                    description={description}
                    footer={
                        <Button onClick={handleDiscoverClick}>
                            {t("wallet.transferEmpty.discover")}
                        </Button>
                    }
                />
            </Box>
        </ResponsiveModal>
    );
}
