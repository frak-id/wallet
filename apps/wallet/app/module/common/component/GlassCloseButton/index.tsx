import { GlassCloseButton as BaseGlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { useTranslation } from "react-i18next";

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
 * Wallet wrapper that injects the i18n default for `aria-label`. The styled
 * primitive lives in `@frak-labs/design-system`.
 */
export function GlassCloseButton({
    onClick,
    disabled,
    label,
}: GlassCloseButtonProps) {
    const { t } = useTranslation();
    return (
        <BaseGlassCloseButton
            onClick={onClick}
            disabled={disabled}
            aria-label={label ?? t("common.close")}
        />
    );
}
