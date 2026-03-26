import { tablet } from "@frak-labs/design-system/breakpoints";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
} from "@frak-labs/design-system/components/Drawer";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { TransferIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import { WalletModal } from "@frak-labs/wallet-shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseButton } from "@/module/common/component/CloseButton";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import * as styles from "./index.css";

function useMediaQuery(query: string) {
    const mediaQueryList = useMemo(() => {
        if (typeof window !== "undefined") {
            return window.matchMedia(query);
        }

        return null;
    }, [query]);

    const [matches, setMatches] = useState(() =>
        mediaQueryList ? mediaQueryList.matches : false
    );

    useEffect(() => {
        if (!mediaQueryList) return;

        const handleChange = () => setMatches(mediaQueryList.matches);
        mediaQueryList.addEventListener("change", handleChange);

        return () => mediaQueryList.removeEventListener("change", handleChange);
    }, [mediaQueryList]);

    return matches;
}

type EmptyTransferModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function EmptyTransferModal({
    open,
    onOpenChange,
}: EmptyTransferModalProps) {
    const { t } = useTranslation();
    const isDesktop = useMediaQuery(`(min-width: ${tablet}px)`);
    const title = t("wallet.transferEmpty.title");
    const description = t("wallet.transferEmpty.description");
    const closeLabel = t("common.close");

    const handleDiscoverClick = () => {
        window.location.assign("/explorer");
    };

    const content = (
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
    );

    if (isDesktop) {
        return (
            <WalletModal
                text={content}
                open={open}
                onOpenChange={onOpenChange}
                closeButton={
                    <CloseButton
                        ariaLabel={closeLabel}
                        iconSize={24}
                        variant="inline"
                        onClick={() => onOpenChange(false)}
                    />
                }
            />
        );
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            shouldScaleBackground={false}
            modal={true}
        >
            <DrawerContent hideHandle={true}>
                <DrawerHeader className={styles.header}>
                    <CloseButton
                        ariaLabel={closeLabel}
                        iconSize={24}
                        variant="inline"
                        onClick={() => onOpenChange(false)}
                    />
                </DrawerHeader>
                <DrawerTitle className={visuallyHidden}>{title}</DrawerTitle>
                <DrawerDescription className={visuallyHidden}>
                    {description}
                </DrawerDescription>
                {content}
            </DrawerContent>
        </Drawer>
    );
}
