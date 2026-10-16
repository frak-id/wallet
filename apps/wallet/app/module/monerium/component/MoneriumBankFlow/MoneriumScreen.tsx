import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    DetailSheet,
    DetailSheetFooter,
} from "@frak-labs/design-system/components/DetailSheet";
import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon, CloseIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Title } from "@/module/common/component/Title";
import { getMoneriumErrorKey } from "@/module/monerium/utils/moneriumErrors";
import * as styles from "./index.css";

type MoneriumScreenProps = {
    onClose: () => void;
    children?: ReactNode;
    title?: string;
    /** Rendered before the children. */
    description?: string;
    /** Rendered after the children, as Monerium error copy. */
    error?: unknown;
    ctaLabel?: string;
    ctaOnClick?: () => void;
    ctaLoading?: boolean;
    ctaDisabled?: boolean;
    secondaryLabel?: string;
    secondaryOnClick?: () => void;
    /** Disables both CTAs while an action started from either is running. */
    busy?: boolean;
    leftIcon?: "close" | "back";
    topRight?: ReactNode;
};

/** Shared layout for every Monerium bank-flow screen: toolbar, title, body and sticky CTA footer. */
export function MoneriumScreen({
    onClose,
    children,
    title,
    description,
    error,
    ctaLabel,
    ctaOnClick,
    ctaLoading,
    ctaDisabled,
    secondaryLabel,
    secondaryOnClick,
    busy = false,
    leftIcon = "close",
    topRight,
}: MoneriumScreenProps) {
    const { t } = useTranslation();

    return (
        <DetailSheet surface="background2">
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
                {description ? (
                    <Text variant="body" color="secondary">
                        {description}
                    </Text>
                ) : null}
                {children}
                {error ? (
                    <Text variant="bodySmall" color="error">
                        {t(getMoneriumErrorKey(error))}
                    </Text>
                ) : null}
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
                        disabled={ctaDisabled || busy}
                    >
                        {ctaLabel}
                    </Button>
                    {secondaryLabel && secondaryOnClick ? (
                        <Button
                            variant="ghost"
                            width="full"
                            size="large"
                            fontSize="s"
                            onClick={secondaryOnClick}
                            disabled={busy}
                        >
                            {secondaryLabel}
                        </Button>
                    ) : null}
                </DetailSheetFooter>
            ) : null}
        </DetailSheet>
    );
}
