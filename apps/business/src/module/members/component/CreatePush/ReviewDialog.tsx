import { Button } from "@frak-labs/design-system/components/Button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
} from "@frak-labs/design-system/components/Dialog";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ExclamationCircleIcon,
    SendIcon,
} from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import * as styles from "./review-dialog.css";
import { deriveScheduledAt } from "./schedule";
import type { PushSchedule } from "./types";

function formatDelivery(scheduledAt: number, locale: string): string {
    const date = new Date(scheduledAt);
    const datePart = new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
    const timePart = new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
    return `${datePart} · ${timePart}`;
}

/**
 * "Review notification" confirmation modal — recaps audience + delivery
 * before publishing.
 */
export function ReviewDialog({
    open,
    onOpenChange,
    schedule,
    targetCount,
    isPending,
    error,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    schedule: PushSchedule;
    targetCount: number;
    isPending: boolean;
    error?: string;
    onConfirm: () => void;
}) {
    const { t, i18n } = useTranslation();
    const scheduledAt = deriveScheduledAt(schedule);
    const delivery = scheduledAt
        ? formatDelivery(scheduledAt, i18n.language)
        : t("push.create.review.immediately");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={styles.modal}
                aria-describedby={undefined}
            >
                <Stack space={"m"} align={"center"}>
                    <IconCircle size={"md"}>
                        <SendIcon className={styles.badgeIcon} />
                    </IconCircle>
                    <Stack space={"m"} className={styles.textBlock}>
                        <DialogTitle className={styles.title}>
                            {t("push.create.review.title")}
                        </DialogTitle>
                        <div className={styles.cellsCard}>
                            <ReviewRow
                                label={t("push.create.review.audience")}
                                value={t("push.create.review.audienceValue", {
                                    total: targetCount,
                                })}
                            />
                            <ReviewRow
                                label={t("push.create.review.delivery")}
                                value={delivery}
                            />
                        </div>
                    </Stack>
                </Stack>
                {error && (
                    <div className={styles.errorBanner} role={"alert"}>
                        <ExclamationCircleIcon className={styles.errorIcon} />
                        <Text variant={"bodySmall"} color={"error"}>
                            {error}
                        </Text>
                    </div>
                )}
                <Inline space={"m"} paddingY={"l"} wrap={false}>
                    <DialogClose asChild>
                        <Button
                            variant={"secondary"}
                            size={"large"}
                            className={styles.button}
                            disabled={isPending}
                        >
                            {t("push.create.review.continueEditing")}
                        </Button>
                    </DialogClose>
                    <Button
                        variant={"primary"}
                        size={"large"}
                        className={styles.button}
                        loading={isPending}
                        disabled={isPending}
                        onClick={onConfirm}
                    >
                        {scheduledAt
                            ? t("push.create.review.schedule")
                            : t("push.create.review.send")}
                    </Button>
                </Inline>
            </DialogContent>
        </Dialog>
    );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
    return (
        <Inline
            space={"m"}
            align={"space-between"}
            alignY={"center"}
            paddingX={"m"}
            wrap={false}
            className={styles.cellRow}
        >
            <Text variant={"bodySmall"} weight={"medium"} color={"secondary"}>
                {label}
            </Text>
            <Text variant={"bodySmall"} weight={"medium"} color={"primary"}>
                {value}
            </Text>
        </Inline>
    );
}
