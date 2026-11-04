import { Button } from "@frak-labs/design-system/components/Button";
import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon, CloseIcon } from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";
import { walletMessages } from "../../messages";
import * as styles from "./flowScreen.css";

type FlowAction = {
    label: string;
    /** Left out for controls the demo shows but never plays. */
    onClick?: () => void;
    loading?: boolean;
};

/** `MoneriumScreen`: the bank flow's full-screen layout, toolbar, title, body and sticky CTA footer. */
export function FlowScreen({
    title,
    description,
    children,
    leftIcon = "close",
    onLeft,
    topRight,
    cta,
    secondary,
}: {
    title?: string;
    description?: string;
    children?: ReactNode;
    leftIcon?: "close" | "back";
    onLeft?: () => void;
    topRight?: ReactNode;
    cta?: FlowAction;
    secondary?: FlowAction;
}) {
    const t = useT(walletMessages);
    return (
        <div className={styles.screen}>
            <div className={styles.column}>
                <div className={styles.toolbar}>
                    <GlassButton
                        as="button"
                        aria-label={t(
                            leftIcon === "back" ? "common.back" : "common.close"
                        )}
                        onClick={onLeft}
                        icon={
                            leftIcon === "back" ? (
                                <ArrowLeftIcon width={22} height={22} />
                            ) : (
                                <CloseIcon width={22} height={22} />
                            )
                        }
                    />
                    {topRight}
                </div>
                {title && <h1 className={styles.title}>{title}</h1>}
                <Stack space="m" className={styles.body}>
                    {description && (
                        <Text variant="body" color="secondary">
                            {description}
                        </Text>
                    )}
                    {children}
                </Stack>
                {cta && (
                    <div className={styles.footer}>
                        <Button
                            variant="primary"
                            width="full"
                            size="large"
                            fontSize="s"
                            loading={cta.loading}
                            onClick={cta.onClick}
                        >
                            {cta.label}
                        </Button>
                        {secondary && (
                            <Button
                                variant="ghost"
                                width="full"
                                size="large"
                                fontSize="s"
                                onClick={secondary.onClick}
                            >
                                {secondary.label}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/** A text-only toolbar action, e.g. the recap's "Cancel". */
export function ToolbarLink({ label }: { label: string }) {
    return (
        <button type="button" className={styles.linkButton}>
            <Text variant="bodySmall" color="action" weight="semiBold">
                {label}
            </Text>
        </button>
    );
}

/** Swaps the flow's screens in place: the next one slides in while the current one fades. */
export function FlowPages({
    page,
    children,
}: {
    page: string;
    children: ReactNode;
}) {
    return (
        <AnimatePresence initial={false}>
            <motion.div
                key={page}
                className={styles.page}
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, pointerEvents: "none" }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
