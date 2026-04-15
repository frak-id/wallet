import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { ResponsiveModal } from "@frak-labs/design-system/components/ResponsiveModal";
import { HourglassIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

type EmptyPendingGainsModalProps = {
    onClose: () => void;
};

export function EmptyPendingGainsModal({
    onClose,
}: EmptyPendingGainsModalProps) {
    const { t } = useTranslation();

    const title = t("wallet.pendingEmpty.title");
    const description = t("wallet.pendingEmpty.description");
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
            <Box className={styles.emptyPendingGains}>
                <ContentBlock
                    icon={
                        <IconCircle>
                            <HourglassIcon
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
                            {t("wallet.pendingEmpty.confirm")}
                        </Button>
                    }
                />
            </Box>
        </ResponsiveModal>
    );
}
