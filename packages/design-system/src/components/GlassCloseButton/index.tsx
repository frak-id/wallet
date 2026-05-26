import { CloseIcon } from "../../icons";
import { GlassButton } from "../GlassButton";

type GlassCloseButtonProps = {
    onClick: () => void;
    disabled?: boolean;
    /** Required accessible name — design-system stays i18n-agnostic. */
    "aria-label": string;
};

/**
 * iOS-26 frosted-glass close affordance. Wraps `GlassButton` so the X sits
 * inside the same liquid-glass circle used by `Back` and detail-sheet share buttons.
 *
 * Apps that want an i18n default should wrap this with their own translation hook.
 */
export function GlassCloseButton({
    onClick,
    disabled,
    "aria-label": ariaLabel,
}: GlassCloseButtonProps) {
    return (
        <GlassButton
            as="button"
            icon={<CloseIcon width={22} height={22} />}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
        />
    );
}
