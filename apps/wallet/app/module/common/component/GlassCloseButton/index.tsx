import { CloseIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";

type GlassCloseButtonProps = {
    onClick: () => void;
    disabled?: boolean;
    /**
     * Accessible name. Defaults to the translated `common.close`. Pass an
     * override (e.g. a screen-specific i18n string) when the surrounding
     * context warrants a more descriptive label.
     */
    label?: string;
};

/**
 * iOS-26 frosted-glass close affordance. Wraps `GlassButton` so the X
 * sits inside the same liquid-glass circle used by `Back` and the
 * detail-sheet share buttons.
 *
 * Use this for full-screen detail sheets / overlays. For plain X buttons
 * inside small confirmation modals (alert dialogs, empty states), reach
 * for `CloseButton` instead — it renders a flat `<button><CloseIcon/></button>`
 * with no glass background.
 */
export function GlassCloseButton({
    onClick,
    disabled,
    label,
}: GlassCloseButtonProps) {
    const { t } = useTranslation();
    return (
        <GlassButton
            as="button"
            icon={<CloseIcon width={22} height={22} />}
            onClick={onClick}
            disabled={disabled}
            aria-label={label ?? t("common.close")}
        />
    );
}
