import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { SheetToolbar } from "@frak-labs/design-system/components/Sheet";
import type { ComponentProps } from "react";

type SheetToolbarProps = ComponentProps<typeof SheetToolbar>;

/**
 * `SheetToolbar` pre-wired with a `GlassCloseButton` in the leading slot — the
 * shared header used by every right-side detail/edit sheet. Pair with
 * `<SheetContent padded={false} hideCloseButton>`.
 */
export function SheetCloseToolbar({
    onClose,
    closeLabel,
    ...toolbarProps
}: Omit<SheetToolbarProps, "leading"> & {
    onClose: () => void;
    closeLabel: string;
}) {
    return (
        <SheetToolbar
            leading={
                <GlassCloseButton onClick={onClose} aria-label={closeLabel} />
            }
            {...toolbarProps}
        />
    );
}
