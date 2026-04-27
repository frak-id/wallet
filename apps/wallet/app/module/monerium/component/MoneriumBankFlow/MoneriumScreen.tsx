import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    DetailSheet,
    DetailSheetFooter,
} from "@frak-labs/design-system/components/DetailSheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { ArrowLeftIcon, CloseIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

type MoneriumScreenProps = {
    onClose: () => void;
    children: ReactNode;
    title?: string;
    ctaLabel?: string;
    ctaOnClick?: () => void;
    ctaLoading?: boolean;
    ctaDisabled?: boolean;
    leftIcon?: "close" | "back";
    topRight?: ReactNode;
};

/**
 * Shared layout for every Monerium bank-flow screen.
 *
 * Renders a full-screen DetailSheet with:
 *  - a close button (top-left)
 *  - flexible content area
 *  - sticky CTA footer
 */
export function MoneriumScreen({
    onClose,
    children,
    title,
    ctaLabel,
    ctaOnClick,
    ctaLoading,
    ctaDisabled,
    leftIcon = "close",
    topRight,
}: MoneriumScreenProps) {
    const { t } = useTranslation();

    return (
        <DetailSheet className={styles.sheetSurface}>
            <Box
                paddingX={"m"}
                paddingTop={"m"}
                display={"flex"}
                alignItems={"center"}
                justifyContent={"space-between"}
            >
                <GlassButton
                    as="button"
                    aria-label={
                        leftIcon === "back"
                            ? t("common.back")
                            : t("common.close")
                    }
                    onClick={onClose}
                    icon={
                        leftIcon === "back" ? (
                            <ArrowLeftIcon width={22} height={22} />
                        ) : (
                            <CloseIcon width={22} height={22} />
                        )
                    }
                />
                {topRight ? <Box>{topRight}</Box> : null}
            </Box>

            {title ? (
                <Box paddingX={"m"} paddingTop={"m"} paddingBottom={"xs"}>
                    <Title size="page">{title}</Title>
                </Box>
            ) : null}

            <Stack space="m" className={styles.bodyStack}>
                {children}
            </Stack>

            {ctaLabel && ctaOnClick ? (
                <DetailSheetFooter>
                    <Button
                        variant="primary"
                        width="full"
                        size="large"
                        fontSize="s"
                        onClick={ctaOnClick}
                        loading={ctaLoading}
                        disabled={ctaDisabled}
                    >
                        {ctaLabel}
                    </Button>
                </DetailSheetFooter>
            ) : null}
        </DetailSheet>
    );
}
