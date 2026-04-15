import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { BarChartIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

type EmptyTransferredGainsModalProps = {
    onClose: () => void;
};

export function EmptyTransferredGainsModal({
    onClose,
}: EmptyTransferredGainsModalProps) {
    const { t } = useTranslation();

    const title = t("wallet.transferredEmpty.title");
    const description = t("wallet.transferredEmpty.description");
    const closeLabel = t("common.close");

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
            <Box className={styles.emptyTransferredGains}>
                <ContentBlock
                    icon={
                        <IconCircle>
                            <BarChartIcon
                                width={24}
                                height={24}
                                color={vars.text.action}
                            />
                        </IconCircle>
                    }
                    title={title}
                    description={description}
                    footer={
                        <Button onClick={onClose}>
                            {t("wallet.transferredEmpty.confirm")}
                        </Button>
                    }
                />
            </Box>
        </ResponsiveModal>
    );
}
