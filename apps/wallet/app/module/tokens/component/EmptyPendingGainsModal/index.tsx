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
import { HourglassIcon } from "@frak-labs/design-system/icons";
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

type EmptyPendingGainsModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function EmptyPendingGainsModal({
    open,
    onOpenChange,
}: EmptyPendingGainsModalProps) {
    const { t } = useTranslation();
    const isDesktop = useMediaQuery(`(min-width: ${tablet}px)`);
    const title = t("wallet.pendingEmpty.title");
    const description = t("wallet.pendingEmpty.description");
    const closeLabel = t("common.close");

    const content = (
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
                    <Button onClick={() => onOpenChange(false)}>
                        {t("wallet.pendingEmpty.confirm")}
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
