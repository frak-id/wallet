import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@frak-labs/design-system/components/AlertDialog";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { ExclamationIcon } from "@frak-labs/design-system/icons";
import clsx from "clsx";
import type { ReactNode } from "react";
import * as styles from "./confirm-dialog.css";

type ConfirmDialogProps = {
    /** Optional trigger element; otherwise control via `open`/`onOpenChange`. */
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: ReactNode;
    description: ReactNode;
    cancelLabel: ReactNode;
    confirmLabel: ReactNode;
    /** Visual weight of the confirm button. */
    confirmTone?: "primary" | "destructive";
    onConfirm: () => void;
    /**
     * When provided, the confirm action runs asynchronously: the button shows
     * a loading state and the dialog does NOT auto-close on click, so the
     * caller can close it once the work resolves (see `onConfirm`).
     */
    isConfirming?: boolean;
    /** Inline error surfaced under the description when the action fails. */
    error?: ReactNode;
};

/**
 * Centered confirmation modal: exclamation badge, title, description and a
 * Cancel / Confirm button pair. Shared by the discard-changes and
 * close-draft flows.
 */
export function ConfirmDialog({
    trigger,
    open,
    onOpenChange,
    title,
    description,
    cancelLabel,
    confirmLabel,
    confirmTone = "primary",
    onConfirm,
    isConfirming,
    error,
}: ConfirmDialogProps) {
    const isAsync = isConfirming !== undefined;
    const confirmButton = (
        <Button
            variant={confirmTone === "primary" ? "primary" : "secondary"}
            size="large"
            loading={isConfirming}
            disabled={isConfirming}
            className={clsx(
                styles.button,
                confirmTone === "destructive" && styles.destructiveButton
            )}
            onClick={onConfirm}
        >
            {confirmLabel}
        </Button>
    );
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            {trigger && (
                <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            )}
            <AlertDialogContent className={styles.content}>
                <Stack space="m" align="center">
                    <IconCircle size="md">
                        <ExclamationIcon className={styles.badgeIcon} />
                    </IconCircle>
                    <AlertDialogTitle className={styles.title}>
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className={styles.description}>
                        {description}
                    </AlertDialogDescription>
                    {error}
                </Stack>
                <Box display="flex" gap="m" paddingTop="l">
                    <AlertDialogCancel asChild>
                        <Button
                            variant="secondary"
                            size="large"
                            className={styles.button}
                        >
                            {cancelLabel}
                        </Button>
                    </AlertDialogCancel>
                    {/* Async actions render a plain button so radix doesn't
                        auto-close the dialog before the work resolves; the
                        caller closes it on success. */}
                    {isAsync ? (
                        confirmButton
                    ) : (
                        <AlertDialogAction asChild>
                            {confirmButton}
                        </AlertDialogAction>
                    )}
                </Box>
            </AlertDialogContent>
        </AlertDialog>
    );
}
