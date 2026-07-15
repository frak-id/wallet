import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import * as sheetStyles from "../BillingInfoSheet/billing-info-sheet.css";

export type AdminBillingSheetProps = {
    /** Label on the closed-state trigger button that opens the sheet. */
    triggerLabel: string;
    /** Sheet toolbar title. */
    title: string;
    /** Sheet toolbar subtitle. */
    subtitle: string;
    /** Label on the primary (submit) footer button. */
    submitLabel: string;
    /** Footer Cancel-button label. */
    cancelLabel: string;
    /** Aria-label for the toolbar's glass close (X) button. */
    closeLabel: string;
    /** True while the form's dirty state should trigger the discard guard. */
    isDirty: boolean;
    /** Called (with the pending close action) when a discard is confirmed. */
    onDiscard: () => void;
    /** Primary-button loading state (mutation pending). */
    isSubmitting: boolean;
    /** Primary-button disabled state (e.g. `!isValid || isSubmitting`). */
    isSubmitDisabled: boolean;
    /** Invoked when the primary button is clicked (typically `form.handleSubmit(onSubmit)`). */
    onSubmit: () => void;
    /**
     * Controlled open state. When provided, the caller owns open/close (the
     * shell still routes user-initiated closes through the discard guard and
     * reports them via `onOpenChange`) — needed so a sheet can close itself
     * programmatically after a successful mutation. Omit for uncontrolled.
     */
    open?: boolean;
    /**
     * Notified whenever the sheet's open state changes (after the discard
     * guard, if any, has been satisfied) — e.g. so a caller can gate a
     * query on "sheet is open" (AddWithdrawSheet's linkable-deposit picker),
     * or drive the controlled `open` prop.
     */
    onOpenChange?: (open: boolean) => void;
    /** Sheet body — the form + any supplementary cards (e.g. the deposit breakdown). */
    children: ReactNode;
};

/**
 * Shared scaffolding for the admin billing sheets (AddDepositSheet /
 * AddWithdrawSheet, billing-feature-fixes.md B6): owns the open/close state,
 * the trigger button, `SheetContent` + close toolbar, the discard-guard
 * wiring (escape/outside-click/close-button all route through the guard),
 * and the Cancel + primary-submit footer. Callers only supply the form body
 * as `children` and the strings/callbacks that differ between the two
 * sheets — the sheet scaffolding itself must stay pixel-identical between
 * them.
 */
export function AdminBillingSheet({
    triggerLabel,
    title,
    subtitle,
    submitLabel,
    cancelLabel,
    closeLabel,
    isDirty,
    onDiscard,
    isSubmitting,
    isSubmitDisabled,
    onSubmit,
    open: controlledOpen,
    onOpenChange,
    children,
}: AdminBillingSheetProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const open = controlledOpen ?? uncontrolledOpen;

    const { guard, dialogProps } = useDiscardGuard({
        isDirty,
        onDiscard,
    });

    function setOpenAndNotify(next: boolean) {
        if (controlledOpen === undefined) {
            setUncontrolledOpen(next);
        }
        onOpenChange?.(next);
    }

    function requestClose() {
        guard(() => setOpenAndNotify(false));
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setOpenAndNotify(true);
                    return;
                }
                requestClose();
            }}
        >
            <SheetTrigger asChild>
                <BusinessButton variant="secondary" size="small">
                    {triggerLabel}
                </BusinessButton>
            </SheetTrigger>
            <SheetContent
                side="right"
                size="wide"
                padded={false}
                hideCloseButton
                onEscapeKeyDown={(e) => {
                    e.preventDefault();
                    requestClose();
                }}
                onInteractOutside={(e) => {
                    e.preventDefault();
                    requestClose();
                }}
            >
                <SheetCloseToolbar
                    size="large"
                    onClose={requestClose}
                    closeLabel={closeLabel}
                    title={title}
                    subtitle={subtitle}
                />
                {children}
                <Inline space="s" padding="l" align="left">
                    <Button
                        variant="secondary"
                        size="large"
                        className={sheetStyles.footerButton}
                        onClick={requestClose}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant="primary"
                        size="large"
                        width="full"
                        className={sheetStyles.footerButton}
                        loading={isSubmitting}
                        onClick={onSubmit}
                        disabled={isSubmitDisabled}
                    >
                        {submitLabel}
                    </Button>
                </Inline>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
