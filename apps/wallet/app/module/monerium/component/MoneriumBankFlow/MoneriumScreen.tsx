import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    DetailSheet,
    DetailSheetFooter,
} from "@frak-labs/design-system/components/DetailSheet";
import { CloseIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

type MoneriumScreenProps = {
    onClose: () => void;
    children: ReactNode;
    ctaLabel: string;
    ctaOnClick: () => void;
    ctaLoading?: boolean;
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
}: MoneriumScreenProps) {
    const { t } = useTranslation();

    return (
        <DetailSheet>
            {/* Close button */}
            <Box paddingX={"m"} paddingTop={"m"}>
                <button
                    type="button"
                    aria-label={t("common.close")}
                    className={styles.closeButton}
                    onClick={onClose}
                >
                    <CloseIcon width={16} height={16} />
                </button>
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
            <DetailSheetFooter>
                <Button
                    variant="primary"
                    width="full"
                    size="medium"
                    onClick={ctaOnClick}
                    loading={ctaLoading}
                >
                    {ctaLabel}
                </Button>
            </DetailSheetFooter>
        </DetailSheet>
    );
}
