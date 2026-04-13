import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    DetailSheet,
    DetailSheetFooter,
} from "@frak-labs/design-system/components/DetailSheet";
import { ArrowLeftIcon, CloseIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

type MoneriumScreenProps = {
    onClose: () => void;
    children: ReactNode;
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
    ctaLabel,
    ctaOnClick,
    ctaLoading,
    ctaDisabled,
    leftIcon = "close",
    topRight,
}: MoneriumScreenProps) {
    const { t } = useTranslation();

    return (
        <DetailSheet>
            {/* Top bar: left icon + optional top-right slot */}
            <Box
                paddingX={"m"}
                paddingTop={"m"}
                display={"flex"}
                alignItems={"center"}
                justifyContent={"space-between"}
            >
                <button
                    type="button"
                    aria-label={
                        leftIcon === "back"
                            ? t("common.back")
                            : t("common.close")
                    }
                    className={styles.closeButton}
                    onClick={onClose}
                >
                    {leftIcon === "back" ? (
                        <ArrowLeftIcon width={16} height={16} />
                    ) : (
                        <CloseIcon width={16} height={16} />
                    )}
                </button>
                {topRight ? <Box>{topRight}</Box> : null}
            </Box>

            {/* Scrollable content */}
            <Box
                display={"flex"}
                flexDirection={"column"}
                gap={"l"}
                flexGrow={1}
                paddingX={"xl"}
                paddingY={"m"}
            >
                {children}
            </Box>

            {/* Sticky CTA */}
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
